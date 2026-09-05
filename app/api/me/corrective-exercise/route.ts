import type { User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient } from "@/lib/admin-data";
import {
  CORRECTIVE_EXERCISE_SEASON_KEY,
  CORRECTIVE_EXERCISE_CONSENT_VERSION,
  MAX_CORRECTIVE_ADDITIONAL_NOTE_LENGTH,
  MAX_CORRECTIVE_HOSPITAL_NOTE_LENGTH,
  MAX_CORRECTIVE_PAIN_AREAS,
  MAX_CORRECTIVE_PAIN_CONTEXT_LENGTH,
  isCorrectiveExerciseHospitalStatus,
  isCorrectiveExercisePainArea,
  isUuid,
  normalizeCorrectiveText,
  type CorrectiveExerciseApplication,
  type CorrectiveExercisePainArea,
  type CorrectiveExerciseSlot,
} from "@/lib/corrective-exercise-contract";
import { getKakaoDisplayName } from "@/lib/kakao-display-name";
import { ensureParticipantAccount } from "@/lib/participant-account-server";
import { guardMutationRequest, guardReadRequest } from "@/lib/request-security";
import { toKstIsoDate } from "@/lib/run-records";
import { logServerFailure } from "@/lib/server-error-log";
import { createClient } from "@/lib/supabase/server";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 12 * 1024;
const CORRECTIVE_EXERCISE_LIVE = process.env.CORRECTIVE_EXERCISE_LIVE === "true";
const ACTIVE_APPLICATION_STATUSES = ["submitted", "reviewing", "schedule_proposed", "confirmed"] as const;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

type JsonBody = Record<string, unknown>;
type MemberContext = {
  authUserId: string;
  adminUserId: string;
  participantId: string;
  participantName: string;
};

type SlotRow = {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string | null;
  capacity: number;
  active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type BookingCountRow = { requested_slot_id: string | null };
type ApplicationRow = {
  id: string;
  participant_id: string;
  participant_name_snapshot: string;
  requested_slot_id: string | null;
  requested_date: string;
  requested_start_time: string;
  requested_end_time: string | null;
  pain_areas: string[];
  pain_context: string;
  hospital_status: string;
  hospital_note: string | null;
  additional_note: string | null;
  status: CorrectiveExerciseApplication["status"];
  confirmed_for: string | null;
  admin_note?: string | null;
  consent_version: string;
  consented_at: string;
  retention_until: string;
  created_at: string;
  updated_at: string;
};

function json(payload: object, status = 200) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}

function setupRequired() {
  return json({
    ...missingSchemaResponse("교정운동 신청 저장소가 아직 준비되지 않았어요."),
    setup_file: "docs/migrations/2026-09-04-corrective-exercise-audit-and-delete.sql",
    prerequisite_file: "docs/migrations/2026-09-04-corrective-exercise.sql",
  }, 503);
}

function hasKakaoIdentity(user: User) {
  return user.app_metadata?.provider === "kakao"
    || Boolean(user.identities?.some((identity) => identity.provider === "kakao"));
}

async function readJsonBody(request: NextRequest, maxBodyBytes = MAX_BODY_BYTES) {
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > maxBodyBytes) {
      return { ok: false as const, response: json({ error: "요청 용량이 너무 커요." }, 413) };
    }
    const value: unknown = JSON.parse(rawBody);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false as const, response: json({ error: "요청 내용을 다시 확인해주세요." }, 400) };
    }
    return { ok: true as const, body: value as JsonBody };
  } catch {
    return { ok: false as const, response: json({ error: "요청 형식을 확인할 수 없어요." }, 400) };
  }
}

async function resolveMemberContext(): Promise<MemberContext | NextResponse> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return json({ error: "카카오 로그인 서버 설정이 아직 준비되지 않았어요." }, 503);
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !hasKakaoIdentity(user)) {
    return json({ error: "교정운동 신청은 카카오 로그인 후 이용할 수 있어요." }, 401);
  }

  const service = getServiceClient();
  if (!service) return json({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, 503);

  const connection = await ensureParticipantAccount(service, user.id, getKakaoDisplayName(user));
  if (connection.status !== "approved" || !connection.adminUserId || !connection.participant) {
    return json({
      error: "개인 계정 연결을 완료하지 못했어요. 잠시 후 다시 시도해주세요.",
      connection_status: connection.status,
      ...(connection.setupRequired ? {
        setup_required: true,
        setup_file: "docs/migrations/2026-09-04-corrective-exercise.sql",
        prerequisite_file: "docs/supabase-schema.sql",
      } : {}),
    }, connection.setupRequired || connection.status === "admin_missing" ? 503 : 403);
  }

  return {
    authUserId: user.id,
    adminUserId: connection.adminUserId,
    participantId: connection.participant.id,
    participantName: connection.displayName || connection.participant.name,
  };
}

function normalizeTime(value: string | null) {
  return value ? value.slice(0, 5) : null;
}

function isUpcomingKstSlot(row: Pick<SlotRow, "slot_date" | "start_time">) {
  const startTime = normalizeTime(row.start_time);
  if (!startTime) return false;
  const timestamp = Date.parse(`${row.slot_date}T${startTime}:00+09:00`);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function serializeApplication(row: ApplicationRow): CorrectiveExerciseApplication {
  return {
    id: row.id,
    participant_id: row.participant_id,
    participant_name: row.participant_name_snapshot,
    requested_slot_id: row.requested_slot_id,
    requested_date: row.requested_date,
    requested_start_time: normalizeTime(row.requested_start_time) || "",
    requested_end_time: normalizeTime(row.requested_end_time),
    pain_areas: row.pain_areas.filter(isCorrectiveExercisePainArea),
    pain_context: row.pain_context,
    hospital_status: isCorrectiveExerciseHospitalStatus(row.hospital_status) ? row.hospital_status : "none",
    hospital_note: row.hospital_note,
    additional_note: row.additional_note,
    status: row.status,
    confirmed_for: row.confirmed_for,
    // Legacy DB column name; this value is a member-visible operator notice, never a private note.
    admin_note: row.admin_note ?? null,
    consent_version: row.consent_version,
    consented_at: row.consented_at,
    retention_until: row.retention_until,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function applicationSelect() {
  return "id, participant_id, participant_name_snapshot, requested_slot_id, requested_date, requested_start_time, requested_end_time, pain_areas, pain_context, hospital_status, hospital_note, additional_note, status, confirmed_for, admin_note, consent_version, consented_at, retention_until, created_at, updated_at";
}

async function readLatestApplication(context: MemberContext) {
  const service = getServiceClient();
  if (!service) return { data: null, error: new Error("service_missing") };
  return service
    .from("corrective_exercise_applications")
    .select(applicationSelect())
    .eq("user_id", context.adminUserId)
    .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
    .eq("auth_user_id", context.authUserId)
    .eq("participant_id", context.participantId)
    .gt("retention_until", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    requireSameOrigin: true,
    rateLimit: { key: "corrective-exercise-member-read", limit: 60, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  try {
    const context = await resolveMemberContext();
    if (context instanceof NextResponse) return context;
    if (!CORRECTIVE_EXERCISE_LIVE) {
      return json({
        slots: [],
        application: null,
        participant_name: context.participantName,
        accepting_applications: false,
      });
    }
    const service = getServiceClient();
    if (!service) return json({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, 503);
    const today = toKstIsoDate(new Date());

    const [slotResult, applicationResult] = await Promise.all([
      service
        .from("corrective_exercise_slots")
        .select("id, slot_date, start_time, end_time, capacity, active, note, created_at, updated_at")
        .eq("user_id", context.adminUserId)
        .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
        .eq("active", true)
        .gte("slot_date", today)
        .order("slot_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(120),
      readLatestApplication(context),
    ]);

    if (slotResult.error || applicationResult.error) {
      const error = slotResult.error || applicationResult.error;
      if (isMissingTableError(error)) return setupRequired();
      throw error;
    }

    const slotRows = ((slotResult.data || []) as SlotRow[]).filter(isUpcomingKstSlot);
    const slotIds = slotRows.map((slot) => slot.id);
    let bookingRows: BookingCountRow[] = [];
    if (slotIds.length > 0) {
      const bookingResult = await service
        .from("corrective_exercise_applications")
        .select("requested_slot_id")
        .eq("user_id", context.adminUserId)
        .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
        .in("status", [...ACTIVE_APPLICATION_STATUSES])
        .gt("retention_until", new Date().toISOString())
        .in("requested_slot_id", slotIds);
      if (bookingResult.error) {
        if (isMissingTableError(bookingResult.error)) return setupRequired();
        throw bookingResult.error;
      }
      bookingRows = (bookingResult.data || []) as BookingCountRow[];
    }

    const bookedBySlot = new Map<string, number>();
    for (const booking of bookingRows) {
      if (!booking.requested_slot_id) continue;
      bookedBySlot.set(booking.requested_slot_id, (bookedBySlot.get(booking.requested_slot_id) || 0) + 1);
    }

    const slots = slotRows.flatMap((row) => {
      const remainingCapacity = Math.max(0, row.capacity - (bookedBySlot.get(row.id) || 0));
      if (remainingCapacity < 1) return [];
      return [{
        id: row.id,
        slot_date: row.slot_date,
        start_time: normalizeTime(row.start_time) || "",
        end_time: normalizeTime(row.end_time),
        capacity: row.capacity,
        remaining_capacity: remainingCapacity,
        active: row.active,
        note: row.note,
      } satisfies CorrectiveExerciseSlot];
    });

    const application = applicationResult.data
      ? serializeApplication(applicationResult.data as unknown as ApplicationRow)
      : null;
    return json({
      slots,
      application,
      participant_name: context.participantName,
      accepting_applications: true,
    });
  } catch (error) {
    logServerFailure("Corrective exercise member read", error);
    return json({ error: "교정운동 신청 정보를 불러오지 못했어요." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: MAX_BODY_BYTES,
    rateLimit: {
      key: "corrective-exercise-member-create",
      limit: 8,
      windowMs: 60_000,
      message: "신청 요청이 잠시 몰렸어요. 잠시 후 다시 시도해주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  try {
    const context = await resolveMemberContext();
    if (context instanceof NextResponse) return context;
    if (!CORRECTIVE_EXERCISE_LIVE) {
      return json({ error: "교정운동 신청은 운영 준비가 끝난 뒤 열려요." }, 503);
    }
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.body;

    const slotId = isUuid(body.slot_id) ? body.slot_id : null;
    const painAreas = Array.isArray(body.pain_areas)
      ? [...new Set(body.pain_areas.filter(isCorrectiveExercisePainArea))] as CorrectiveExercisePainArea[]
      : [];
    const painContext = normalizeCorrectiveText(
      body.pain_context ?? body.pain_trigger,
      MAX_CORRECTIVE_PAIN_CONTEXT_LENGTH,
      true,
    );
    const hospitalStatus = isCorrectiveExerciseHospitalStatus(body.hospital_status) ? body.hospital_status : null;
    const hospitalNote = normalizeCorrectiveText(body.hospital_note, MAX_CORRECTIVE_HOSPITAL_NOTE_LENGTH);
    const additionalNote = normalizeCorrectiveText(body.additional_note, MAX_CORRECTIVE_ADDITIONAL_NOTE_LENGTH);

    if (!slotId) return json({ error: "신청 가능한 날짜와 시간을 다시 선택해주세요." }, 400);
    if (painAreas.length < 1 || painAreas.length > MAX_CORRECTIVE_PAIN_AREAS) {
      return json({ error: `불편한 부위는 1~${MAX_CORRECTIVE_PAIN_AREAS}개 선택해주세요.` }, 400);
    }
    if (!painContext || painContext.length < 10) {
      return json({ error: "언제, 어떤 움직임에서 불편한지 10자 이상 적어주세요." }, 400);
    }
    if (!hospitalStatus) return json({ error: "병원 이용 여부를 선택해주세요." }, 400);
    if (hospitalNote === null || additionalNote === null) {
      return json({ error: "입력 가능한 글자 수를 초과했어요." }, 400);
    }
    if (body.consent !== true && body.sensitive_data_consent !== true) {
      return json({ error: "신청을 위해 건강 관련 정보 수집·이용 동의가 필요해요." }, 400);
    }

    const service = getServiceClient();
    if (!service) return json({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, 503);
    const { data: applicationId, error } = await service.rpc("submit_corrective_exercise_application", {
      p_user_id: context.adminUserId,
      p_season_key: CORRECTIVE_EXERCISE_SEASON_KEY,
      p_auth_user_id: context.authUserId,
      p_participant_id: context.participantId,
      p_participant_name: context.participantName,
      p_slot_id: slotId,
      p_pain_areas: painAreas,
      p_pain_context: painContext,
      p_hospital_status: hospitalStatus,
      p_hospital_note: hospitalStatus === "none" ? null : hospitalNote || null,
      p_additional_note: additionalNote || null,
      p_consent_version: CORRECTIVE_EXERCISE_CONSENT_VERSION,
    });

    if (error) {
      if (isMissingTableError(error)) return setupRequired();
      if (error.code === "23505" || error.message?.includes("active application exists")) {
        return json({ error: "이미 확인 중인 신청이 있어요. 기존 신청을 확인해주세요." }, 409);
      }
      if (error.code === "23514" && error.message?.includes("slot unavailable")) {
        return json({ error: "선택한 일정의 신청이 마감됐어요. 다른 일정을 선택해주세요." }, 409);
      }
      if (error.code === "23514" && error.message?.includes("participant")) {
        return json({ error: "크루 승인 상태가 변경됐어요. 운영자에게 확인해주세요." }, 403);
      }
      throw error;
    }
    if (!isUuid(applicationId)) throw new Error("invalid_application_id");

    const { data, error: readError } = await service
      .from("corrective_exercise_applications")
      .select(applicationSelect())
      .eq("id", applicationId)
      .eq("user_id", context.adminUserId)
      .eq("auth_user_id", context.authUserId)
      .single();
    if (readError) throw readError;

    return json({ application: serializeApplication(data as unknown as ApplicationRow) }, 201);
  } catch (error) {
    logServerFailure("Corrective exercise member create", error);
    return json({ error: "교정운동 신청을 접수하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 2 * 1024,
    rateLimit: { key: "corrective-exercise-member-cancel", limit: 8, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  try {
    const context = await resolveMemberContext();
    if (context instanceof NextResponse) return context;
    const bodyResult = await readJsonBody(request, 2 * 1024);
    if (!bodyResult.ok) return bodyResult.response;
    const { body } = bodyResult;
    const applicationId = body.id ?? body.application_id;
    if ((body.action !== "cancel" && body.action !== "cancel_application") || !isUuid(applicationId)) {
      return json({ error: "취소할 신청을 다시 확인해주세요." }, 400);
    }

    const service = getServiceClient();
    if (!service) return json({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, 503);
    const { data: cancelledId, error } = await service.rpc("cancel_corrective_exercise_application_member", {
      p_user_id: context.adminUserId,
      p_season_key: CORRECTIVE_EXERCISE_SEASON_KEY,
      p_application_id: applicationId,
      p_auth_user_id: context.authUserId,
      p_participant_id: context.participantId,
    });
    if (error) {
      if (isMissingTableError(error)) return setupRequired();
      if (error.code === "P0002") return json({ error: "취소할 수 있는 신청을 찾지 못했어요." }, 409);
      throw error;
    }
    if (!isUuid(cancelledId)) throw new Error("invalid_cancelled_application_id");

    const { data, error: readError } = await service
      .from("corrective_exercise_applications")
      .select(applicationSelect())
      .eq("id", cancelledId)
      .eq("user_id", context.adminUserId)
      .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
      .eq("auth_user_id", context.authUserId)
      .eq("participant_id", context.participantId)
      .single();
    if (readError) throw readError;

    return json({ application: serializeApplication(data as unknown as ApplicationRow) });
  } catch (error) {
    logServerFailure("Corrective exercise member cancel", error);
    return json({ error: "신청을 취소하지 못했어요." }, 500);
  }
}
