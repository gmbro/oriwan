import { NextRequest, NextResponse } from "next/server";

import { requireAdminDataAccess } from "@/lib/admin-data-access";
import {
  CORRECTIVE_EXERCISE_SEASON_KEY,
  MAX_CORRECTIVE_ADMIN_NOTE_LENGTH,
  MAX_CORRECTIVE_SLOT_CAPACITY,
  MAX_CORRECTIVE_SLOT_NOTE_LENGTH,
  isCorrectiveExerciseApplicationStatus,
  isCorrectiveExerciseHospitalStatus,
  isCorrectiveExercisePainArea,
  isIsoDate,
  isUuid,
  normalizeCorrectiveText,
  normalizeCorrectiveTime,
  type CorrectiveExerciseApplication,
  type CorrectiveExerciseApplicationSummary,
  type CorrectiveExerciseSlot,
} from "@/lib/corrective-exercise-contract";
import {
  FOURTH_SEASON_END_DATE,
  FOURTH_SEASON_START_DATE,
  isWithinFourthSeasonWindow,
} from "@/lib/fourth-season-contract";
import { guardMutationRequest, guardReadRequest } from "@/lib/request-security";
import { toKstIsoDate } from "@/lib/run-records";
import { logServerFailure } from "@/lib/server-error-log";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 12 * 1024;
const OFFSET_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;
const ACTIVE_APPLICATION_STATUSES = ["submitted", "reviewing", "schedule_proposed", "confirmed"] as const;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

type JsonBody = Record<string, unknown>;
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
  admin_note: string | null;
  consent_version: string;
  consented_at: string;
  retention_until: string;
  created_at: string;
  updated_at: string;
};
type ApplicationSummaryRow = Pick<
  ApplicationRow,
  | "id"
  | "participant_id"
  | "participant_name_snapshot"
  | "requested_slot_id"
  | "requested_date"
  | "requested_start_time"
  | "requested_end_time"
  | "status"
  | "confirmed_for"
  | "retention_until"
  | "created_at"
  | "updated_at"
>;

function json(payload: object, status = 200) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}

function setupRequired() {
  return json({
    ...missingSchemaResponse("교정운동 운영 저장소가 아직 준비되지 않았어요."),
    setup_file: "docs/migrations/2026-09-04-corrective-exercise.sql",
  }, 503);
}

async function readJsonBody(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
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

function applicationSelect() {
  return "id, participant_id, participant_name_snapshot, requested_slot_id, requested_date, requested_start_time, requested_end_time, pain_areas, pain_context, hospital_status, hospital_note, additional_note, status, confirmed_for, admin_note, consent_version, consented_at, retention_until, created_at, updated_at";
}

function applicationSummarySelect() {
  return "id, participant_id, participant_name_snapshot, requested_slot_id, requested_date, requested_start_time, requested_end_time, status, confirmed_for, retention_until, created_at, updated_at";
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
    requested_start_time: normalizeTime(row.requested_start_time) || "",
    requested_end_time: normalizeTime(row.requested_end_time),
    pain_areas: row.pain_areas.filter(isCorrectiveExercisePainArea),
    pain_context: row.pain_context,
    hospital_status: isCorrectiveExerciseHospitalStatus(row.hospital_status) ? row.hospital_status : "none",
    hospital_note: row.hospital_note,
    additional_note: row.additional_note,
    status: row.status,
    confirmed_for: row.confirmed_for,
    admin_note: row.admin_note,
    consent_version: row.consent_version,
    consented_at: row.consented_at,
    retention_until: row.retention_until,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeApplicationSummary(row: ApplicationSummaryRow): CorrectiveExerciseApplicationSummary {
  return {
    id: row.id,
    participant_id: row.participant_id,
    participant_name: row.participant_name_snapshot,
    requested_slot_id: row.requested_slot_id,
    requested_date: row.requested_date,
    requested_start_time: normalizeTime(row.requested_start_time) || "",
    requested_end_time: normalizeTime(row.requested_end_time),
    status: row.status,
    confirmed_for: row.confirmed_for,
    retention_until: row.retention_until,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeSlot(row: SlotRow, booked: number): CorrectiveExerciseSlot {
  return {
    id: row.id,
    slot_date: row.slot_date,
    start_time: normalizeTime(row.start_time) || "",
    end_time: normalizeTime(row.end_time),
    capacity: row.capacity,
    remaining_capacity: Math.max(0, row.capacity - booked),
    active: row.active,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseSlotBody(body: JsonBody, partial: boolean) {
  const patch: Record<string, string | number | boolean | null> = {};

  if (!partial || Object.hasOwn(body, "slot_date")) {
    if (!isIsoDate(body.slot_date) || !isWithinFourthSeasonWindow(body.slot_date)) {
      return { error: `가능 날짜는 ${FOURTH_SEASON_START_DATE}~${FOURTH_SEASON_END_DATE} 사이에서 선택해주세요.` };
    }
    patch.slot_date = body.slot_date;
  }
  if (!partial || Object.hasOwn(body, "start_time")) {
    const startTime = normalizeCorrectiveTime(body.start_time);
    if (!startTime) return { error: "시작 시간을 다시 확인해주세요." };
    patch.start_time = startTime;
  }
  if (!partial || Object.hasOwn(body, "end_time")) {
    if (body.end_time === null || body.end_time === "" || body.end_time === undefined) {
      patch.end_time = null;
    } else {
      const endTime = normalizeCorrectiveTime(body.end_time);
      if (!endTime) return { error: "종료 시간을 다시 확인해주세요." };
      patch.end_time = endTime;
    }
  }
  if (!partial || Object.hasOwn(body, "capacity")) {
    if (!Number.isInteger(body.capacity) || Number(body.capacity) < 1 || Number(body.capacity) > MAX_CORRECTIVE_SLOT_CAPACITY) {
      return { error: `정원은 1~${MAX_CORRECTIVE_SLOT_CAPACITY}명으로 입력해주세요.` };
    }
    patch.capacity = Number(body.capacity);
  }
  if (!partial || Object.hasOwn(body, "active")) {
    if (body.active === undefined && !partial) patch.active = true;
    else if (typeof body.active === "boolean") patch.active = body.active;
    else return { error: "일정 공개 상태를 다시 확인해주세요." };
  }
  if (!partial || Object.hasOwn(body, "note")) {
    const note = normalizeCorrectiveText(body.note, MAX_CORRECTIVE_SLOT_NOTE_LENGTH);
    if (note === null) return { error: "일정 안내가 너무 길어요." };
    patch.note = note || null;
  }

  if (partial && Object.keys(patch).length === 0) return { error: "수정할 일정 정보가 없어요." };
  return { patch };
}

function validateSlotTimes(startTime: unknown, endTime: unknown) {
  return typeof startTime === "string"
    && (endTime === null || (typeof endTime === "string" && endTime > startTime));
}

function isFutureKstSlot(slotDate: unknown, startTime: unknown) {
  if (typeof slotDate !== "string" || typeof startTime !== "string") return false;
  const timestamp = Date.parse(`${slotDate}T${startTime.slice(0, 5)}:00+09:00`);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function canTransitionApplication(
  from: CorrectiveExerciseApplication["status"],
  to: CorrectiveExerciseApplication["status"],
) {
  if (from === to) return true;
  const transitions: Record<CorrectiveExerciseApplication["status"], readonly CorrectiveExerciseApplication["status"][]> = {
    submitted: ["reviewing", "schedule_proposed", "confirmed", "cancelled", "rejected"],
    reviewing: ["schedule_proposed", "confirmed", "cancelled", "rejected"],
    schedule_proposed: ["reviewing", "confirmed", "cancelled", "rejected"],
    confirmed: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
    rejected: [],
  };
  return transitions[from].includes(to);
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    requireSameOrigin: true,
    rateLimit: { key: "admin-corrective-exercise-read", limit: 120, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;

  try {
    const applicationId = request.nextUrl.searchParams.get("id");
    if (applicationId !== null) {
      if (!isUuid(applicationId)) return json({ error: "확인할 신청을 다시 선택해주세요." }, 400);

      const { data, error } = await service
        .from("corrective_exercise_applications")
        .select(applicationSelect())
        .eq("id", applicationId)
        .eq("user_id", user.id)
        .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
        .gt("retention_until", new Date().toISOString())
        .maybeSingle();
      if (error) {
        if (isMissingTableError(error)) return setupRequired();
        throw error;
      }
      if (!data) return json({ error: "확인할 신청을 찾지 못했어요." }, 404);

      // 원문 자체는 절대 감사 로그에 복제하지 않고, 누가 어느 신청을 열람했는지만 남깁니다.
      const { error: auditError } = await service
        .from("corrective_exercise_audit_logs")
        .insert({
          user_id: user.id,
          operator_auth_user_id: user.id,
          application_id: applicationId,
          event_type: "detail_viewed",
        });
      if (auditError) {
        if (isMissingTableError(auditError)) return setupRequired();
        throw auditError;
      }

      return json({ application: serializeApplication(data as unknown as ApplicationRow) });
    }

    const [slotResult, applicationResult] = await Promise.all([
      service
        .from("corrective_exercise_slots")
        .select("id, slot_date, start_time, end_time, capacity, active, note, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
        .order("slot_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(500),
      service
        .from("corrective_exercise_applications")
        .select(applicationSummarySelect())
        .eq("user_id", user.id)
        .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
        .gt("retention_until", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (slotResult.error || applicationResult.error) {
      const error = slotResult.error || applicationResult.error;
      if (isMissingTableError(error)) return setupRequired();
      throw error;
    }

    const slots = (slotResult.data || []) as SlotRow[];
    const applications = (applicationResult.data || []) as unknown as ApplicationSummaryRow[];
    const bookedBySlot = new Map<string, number>();
    for (const application of applications) {
      if (!application.requested_slot_id || !ACTIVE_APPLICATION_STATUSES.includes(application.status as typeof ACTIVE_APPLICATION_STATUSES[number])) continue;
      bookedBySlot.set(application.requested_slot_id, (bookedBySlot.get(application.requested_slot_id) || 0) + 1);
    }

    return json({
      slots: slots.map((slot) => serializeSlot(slot, bookedBySlot.get(slot.id) || 0)),
      applications: applications.map(serializeApplicationSummary),
    });
  } catch (error) {
    logServerFailure("Admin corrective exercise read", error);
    return json({ error: "교정운동 신청 내역을 불러오지 못했어요." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: MAX_BODY_BYTES,
    rateLimit: { key: "admin-corrective-exercise-create", limit: 40, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const { body } = bodyResult;
  if (body.action !== "create_slot") return json({ error: "생성할 항목을 다시 확인해주세요." }, 400);

  const parsed = parseSlotBody(body, false);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  if (!validateSlotTimes(parsed.patch.start_time, parsed.patch.end_time)) {
    return json({ error: "종료 시간은 시작 시간보다 늦어야 해요." }, 400);
  }
  if (!isFutureKstSlot(parsed.patch.slot_date, parsed.patch.start_time)) {
    return json({ error: "현재보다 이후인 일정을 선택해주세요." }, 400);
  }

  try {
    const { data, error } = await service
      .from("corrective_exercise_slots")
      .insert({
        ...parsed.patch,
        user_id: user.id,
        season_key: CORRECTIVE_EXERCISE_SEASON_KEY,
        updated_at: new Date().toISOString(),
      })
      .select("id, slot_date, start_time, end_time, capacity, active, note, created_at, updated_at")
      .single();
    if (error?.code === "23505") return json({ error: "같은 날짜와 시작 시간이 이미 등록되어 있어요." }, 409);
    if (error) {
      if (isMissingTableError(error)) return setupRequired();
      throw error;
    }
    return json({ slot: serializeSlot(data as unknown as SlotRow, 0) }, 201);
  } catch (error) {
    logServerFailure("Admin corrective exercise slot create", error);
    return json({ error: "신청 가능 일정을 저장하지 못했어요." }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: MAX_BODY_BYTES,
    rateLimit: { key: "admin-corrective-exercise-update", limit: 60, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const { body } = bodyResult;
  if (!isUuid(body.id)) return json({ error: "수정할 항목을 다시 선택해주세요." }, 400);

  if (body.action === "update_slot") {
    const parsed = parseSlotBody(body, true);
    if ("error" in parsed) return json({ error: parsed.error }, 400);

    try {
      const { data: existing, error: existingError } = await service
        .from("corrective_exercise_slots")
        .select("id, slot_date, start_time, end_time, capacity, active, note, created_at, updated_at")
        .eq("id", body.id)
        .eq("user_id", user.id)
        .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
        .maybeSingle();
      if (existingError) {
        if (isMissingTableError(existingError)) return setupRequired();
        throw existingError;
      }
      if (!existing) return json({ error: "수정할 일정을 찾지 못했어요." }, 404);

      const current = existing as unknown as SlotRow;
      const startTime = typeof parsed.patch.start_time === "string" ? parsed.patch.start_time : normalizeTime(current.start_time);
      const endTime = Object.hasOwn(parsed.patch, "end_time") ? parsed.patch.end_time : normalizeTime(current.end_time);
      if (!validateSlotTimes(startTime, endTime)) {
        return json({ error: "종료 시간은 시작 시간보다 늦어야 해요." }, 400);
      }
      const slotDate = typeof parsed.patch.slot_date === "string" ? parsed.patch.slot_date : current.slot_date;
      const scheduleChanged = slotDate !== current.slot_date
        || startTime !== normalizeTime(current.start_time)
        || endTime !== normalizeTime(current.end_time);
      if (scheduleChanged && !isFutureKstSlot(slotDate, startTime)) {
        return json({ error: "현재보다 이후인 일정을 선택해주세요." }, 400);
      }
      const capacity = typeof parsed.patch.capacity === "number" ? parsed.patch.capacity : current.capacity;
      const active = typeof parsed.patch.active === "boolean" ? parsed.patch.active : current.active;
      const note = Object.hasOwn(parsed.patch, "note") ? parsed.patch.note : current.note;

      const { error } = await service.rpc("update_corrective_exercise_slot", {
        p_user_id: user.id,
        p_season_key: CORRECTIVE_EXERCISE_SEASON_KEY,
        p_slot_id: body.id,
        p_expected_updated_at: current.updated_at,
        p_slot_date: slotDate,
        p_start_time: startTime,
        p_end_time: endTime,
        p_capacity: capacity,
        p_active: active,
        p_note: note,
      });
      if (error?.code === "23505") return json({ error: "같은 날짜와 시작 시간이 이미 등록되어 있어요." }, 409);
      if (error?.code === "40001") return json({ error: "다른 변경이 먼저 저장됐어요. 새로고침 후 다시 시도해주세요." }, 409);
      if (error?.code === "23514" && error.message?.includes("bookings exist")) {
        return json({ error: "신청자가 있는 일정의 날짜·시간은 바꿀 수 없어요. 비활성화한 뒤 새 일정을 만들어주세요." }, 409);
      }
      if (error?.code === "23514" && error.message?.includes("capacity below bookings")) {
        return json({ error: "현재 신청 인원보다 정원을 줄일 수 없어요." }, 409);
      }
      if (error?.code === "23514" && error.message?.includes("past schedule")) {
        return json({ error: "현재보다 이후인 일정을 선택해주세요." }, 400);
      }
      if (error) {
        if (isMissingTableError(error)) return setupRequired();
        throw error;
      }

      const [updatedResult, countResult] = await Promise.all([
        service
          .from("corrective_exercise_slots")
          .select("id, slot_date, start_time, end_time, capacity, active, note, created_at, updated_at")
          .eq("id", body.id)
          .eq("user_id", user.id)
          .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
          .maybeSingle(),
        service
          .from("corrective_exercise_applications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
          .eq("requested_slot_id", body.id)
          .in("status", [...ACTIVE_APPLICATION_STATUSES])
          .gt("retention_until", new Date().toISOString()),
      ]);
      if (updatedResult.error || countResult.error) {
        const readError = updatedResult.error || countResult.error;
        if (isMissingTableError(readError)) return setupRequired();
        throw readError;
      }
      if (!updatedResult.data) return json({ error: "수정한 일정을 찾지 못했어요." }, 404);
      return json({
        slot: serializeSlot(updatedResult.data as unknown as SlotRow, countResult.count || 0),
      });
    } catch (error) {
      logServerFailure("Admin corrective exercise slot update", error);
      return json({ error: "신청 가능 일정을 수정하지 못했어요." }, 500);
    }
  }

  if (body.action === "update_application") {
    const status = isCorrectiveExerciseApplicationStatus(body.status) ? body.status : null;
    const patch: Record<string, string | null> = {};
    if (!status) return json({ error: "신청 처리 상태를 다시 선택해주세요." }, 400);
    patch.status = status;

    if (Object.hasOwn(body, "confirmed_for")) {
      if (body.confirmed_for === null || body.confirmed_for === "") patch.confirmed_for = null;
      else if (typeof body.confirmed_for === "string"
        && OFFSET_TIMESTAMP_PATTERN.test(body.confirmed_for)
        && Number.isFinite(Date.parse(body.confirmed_for))) {
        const confirmedDate = new Date(body.confirmed_for);
        const confirmedFor = confirmedDate.toISOString();
        if (!isWithinFourthSeasonWindow(toKstIsoDate(confirmedDate))) {
          return json({ error: `확정 일정은 ${FOURTH_SEASON_START_DATE}~${FOURTH_SEASON_END_DATE} 사이여야 해요.` }, 400);
        }
        if ((status === "schedule_proposed" || status === "confirmed") && confirmedDate.getTime() <= Date.now()) {
          return json({ error: "일정 조율 또는 확정 일시는 현재보다 이후여야 해요." }, 400);
        }
        patch.confirmed_for = confirmedFor;
      } else return json({ error: "확정 일시를 다시 확인해주세요." }, 400);
    }
    if (Object.hasOwn(body, "admin_note")) {
      const adminNote = normalizeCorrectiveText(body.admin_note, MAX_CORRECTIVE_ADMIN_NOTE_LENGTH);
      if (adminNote === null) return json({ error: "운영 메모가 너무 길어요." }, 400);
      patch.admin_note = adminNote || null;
    }

    try {
      const { data: existing, error: existingError } = await service
        .from("corrective_exercise_applications")
        .select("id, status, confirmed_for, updated_at")
        .eq("id", body.id)
        .eq("user_id", user.id)
        .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
        .gt("retention_until", new Date().toISOString())
        .maybeSingle();
      if (existingError) {
        if (isMissingTableError(existingError)) return setupRequired();
        throw existingError;
      }
      if (!existing) return json({ error: "처리할 신청을 찾지 못했어요." }, 404);
      const existingStatus = isCorrectiveExerciseApplicationStatus(existing.status) ? existing.status : null;
      if (!existingStatus || !canTransitionApplication(existingStatus, status)) {
        return json({ error: "현재 상태에서는 선택한 처리 단계로 변경할 수 없어요." }, 409);
      }
      if ((status === "schedule_proposed" || status === "confirmed")
        && !(Object.hasOwn(patch, "confirmed_for") ? patch.confirmed_for : existing.confirmed_for)) {
        return json({ error: "일정 조율 또는 확정 상태에는 약속 일시를 입력해주세요." }, 400);
      }
      if ((status === "schedule_proposed" || status === "confirmed") && existingStatus !== status) {
        const effectiveConfirmedFor = Object.hasOwn(patch, "confirmed_for")
          ? patch.confirmed_for
          : existing.confirmed_for;
        const effectiveConfirmedDate = effectiveConfirmedFor ? new Date(effectiveConfirmedFor) : null;
        if (!effectiveConfirmedDate
          || Number.isNaN(effectiveConfirmedDate.getTime())
          || effectiveConfirmedDate.getTime() <= Date.now()
          || !isWithinFourthSeasonWindow(toKstIsoDate(effectiveConfirmedDate))) {
          return json({ error: "일정 조율 또는 확정 일시는 4기 기간 안의 미래 시간이어야 해요." }, 400);
        }
      }

      const now = new Date().toISOString();
      if (status === "cancelled") {
        patch.cancelled_at = now;
        patch.confirmed_for = null;
      }
      const { data, error } = await service
        .from("corrective_exercise_applications")
        .update({ ...patch, updated_at: now })
        .eq("id", body.id)
        .eq("user_id", user.id)
        .eq("season_key", CORRECTIVE_EXERCISE_SEASON_KEY)
        .eq("status", existingStatus)
        .eq("updated_at", existing.updated_at)
        .gt("retention_until", now)
        .select(applicationSummarySelect())
        .maybeSingle();
      if (error?.code === "23505") return json({ error: "이 회원에게 이미 진행 중인 다른 신청이 있어요." }, 409);
      if (error) throw error;
      if (!data) return json({ error: "신청 상태가 다른 곳에서 먼저 변경됐어요. 새로고침 후 다시 시도해주세요." }, 409);
      return json({ application_summary: serializeApplicationSummary(data as unknown as ApplicationSummaryRow) });
    } catch (error) {
      logServerFailure("Admin corrective exercise application update", error);
      return json({ error: "신청 상태를 변경하지 못했어요." }, 500);
    }
  }

  return json({ error: "수정할 항목 종류를 다시 확인해주세요." }, 400);
}
