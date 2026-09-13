import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import {
  CORRECTIVE_EXERCISE_SEASON_KEY,
  isCorrectiveExerciseHospitalStatus,
  isCorrectiveExercisePainArea,
  isUuid,
  parseCorrectiveInquiryInput,
  type CorrectiveExerciseApplication,
} from "@/lib/corrective-exercise-contract";
import { resolvePersonalMemberContext } from "@/lib/personal-member-context";
import { guardMutationRequest, guardReadRequest, readLimitedJson } from "@/lib/request-security";
import { logServerFailure } from "@/lib/server-error-log";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 12 * 1024;
const CORRECTIVE_EXERCISE_LIVE = process.env.CORRECTIVE_EXERCISE_LIVE === "true";
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

type JsonBody = Record<string, unknown>;
type MemberContext = {
  service: SupabaseClient;
  authUserId: string;
  adminUserId: string;
  participantId: string;
  participantName: string;
};

type ApplicationRow = {
  id: string;
  participant_id: string;
  participant_name_snapshot: string;
  requested_slot_id: string | null;
  requested_date: string | null;
  requested_start_time: string | null;
  requested_end_time: string | null;
  pain_areas: string[] | null;
  pain_context: string | null;
  hospital_status: string | null;
  hospital_note: string | null;
  additional_note: string | null;
  inquiry_message: string | null;
  status: CorrectiveExerciseApplication["status"];
  confirmed_for: string | null;
  admin_note?: string | null;
  consent_version: string | null;
  consented_at: string | null;
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
    setup_file: "docs/migrations/2026-09-07-corrective-exercise-repeat-inquiries.sql",
    prerequisite_file: "docs/migrations/2026-09-06-corrective-exercise-simple-inquiry.sql",
  }, 503);
}

async function readJsonBody(request: NextRequest, maxBodyBytes = MAX_BODY_BYTES) {
  const parsed = await readLimitedJson(request, maxBodyBytes);
  if (!parsed.ok) return parsed;
  return { ok: true as const, body: parsed.value };
}

async function resolveMemberContext(): Promise<MemberContext | NextResponse> {
  const resolution = await resolvePersonalMemberContext();
  if (!resolution.ok) {
    if (resolution.reason === "configuration_unavailable") {
      return json({ error: "카카오 로그인 서버 설정이 아직 준비되지 않았어요." }, 503);
    }
    if (resolution.reason === "unauthenticated") {
      return json({ error: "교정운동 신청은 카카오 로그인 후 이용할 수 있어요." }, 401);
    }
    return json({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, 503);
  }

  const { authUserId, service, connection } = resolution;
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
    service,
    authUserId,
    adminUserId: connection.adminUserId,
    participantId: connection.participant.id,
    participantName: connection.displayName || connection.participant.name,
  };
}

function normalizeTime(value: string | null) {
  return value ? value.slice(0, 5) : null;
}

function serializeApplication(row: ApplicationRow): CorrectiveExerciseApplication {
  return {
    id: row.id,
    participant_id: row.participant_id,
    participant_name: row.participant_name_snapshot,
    requested_slot_id: row.requested_slot_id,
    requested_date: row.requested_date,
    requested_start_time: normalizeTime(row.requested_start_time),
    requested_end_time: normalizeTime(row.requested_end_time),
    pain_areas: (row.pain_areas || []).filter(isCorrectiveExercisePainArea),
    pain_context: row.pain_context,
    hospital_status: isCorrectiveExerciseHospitalStatus(row.hospital_status) ? row.hospital_status : null,
    hospital_note: row.hospital_note,
    additional_note: row.additional_note,
    inquiry_message: row.inquiry_message,
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
  return "id, participant_id, participant_name_snapshot, requested_slot_id, requested_date, requested_start_time, requested_end_time, pain_areas, pain_context, hospital_status, hospital_note, additional_note, inquiry_message, status, confirmed_for, admin_note, consent_version, consented_at, retention_until, created_at, updated_at";
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
    // Repeated inquiries always start with a blank form, so avoid a history query on modal open.
    return json({
      application: null,
      participant_name: context.participantName,
      accepting_applications: true,
    });
  } catch (error) {
    logServerFailure("Corrective exercise member read", error);
    return json({ error: "교정운동 문의 정보를 불러오지 못했어요." }, 500);
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

    const inquiryResult = parseCorrectiveInquiryInput(body);
    if (!inquiryResult.ok) return json({ error: inquiryResult.error }, 400);
    const inquiryMessage = inquiryResult.value.inquiry_message;

    const { error: cleanupError } = await context.service
      .from("corrective_exercise_applications")
      .delete()
      .eq("user_id", context.adminUserId)
      .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
      .eq("auth_user_id", context.authUserId)
      .eq("participant_id", context.participantId)
      .lte("retention_until", new Date().toISOString());
    if (cleanupError) {
      if (isMissingTableError(cleanupError)) return setupRequired();
      throw cleanupError;
    }
    // The repeat-inquiries migration removes the old one-active-inquiry index.
    // Keep each submission so operators retain the full contact history.
    const { data, error } = await context.service
      .from("corrective_exercise_applications")
      .insert({
        user_id: context.adminUserId,
        season_key: CORRECTIVE_EXERCISE_SEASON_KEY,
        auth_user_id: context.authUserId,
        participant_id: context.participantId,
        participant_name_snapshot: context.participantName,
        requested_slot_id: null,
        requested_date: null,
        requested_start_time: null,
        requested_end_time: null,
        pain_areas: null,
        pain_context: null,
        hospital_status: null,
        hospital_note: null,
        additional_note: null,
        inquiry_message: inquiryMessage,
        consent_version: null,
        consented_at: null,
      })
      .select(applicationSelect())
      .single();

    if (error) {
      if (isMissingTableError(error)) return setupRequired();
      if (error.code === "23505") {
        return json({
          error: "새 문의를 받기 위한 설정을 적용 중이에요. 잠시 후 다시 시도해주세요.",
          setup_required: true,
          setup_file: "docs/migrations/2026-09-07-corrective-exercise-repeat-inquiries.sql",
        }, 503);
      }
      throw error;
    }

    return json({ application: serializeApplication(data as unknown as ApplicationRow) }, 201);
  } catch (error) {
    logServerFailure("Corrective exercise member create", error);
    return json({ error: "교정운동 문의를 접수하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
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

    const { data: cancelledId, error } = await context.service.rpc("cancel_corrective_exercise_application_member", {
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

    const { data, error: readError } = await context.service
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
    return json({ error: "문의를 취소하지 못했어요." }, 500);
  }
}
