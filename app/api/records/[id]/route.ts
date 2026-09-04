import { NextRequest, NextResponse } from "next/server";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { calculatePaceSeconds } from "@/lib/run-records";
import { guardMutationRequest } from "@/lib/request-security";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import {
  FOURTH_SEASON_DATE_ERROR,
  FOURTH_SEASON_KEY,
  isWithinFourthSeasonWindow,
} from "@/lib/fourth-season-contract";
import { logServerFailure } from "@/lib/server-error-log";

const RECORD_STATUSES = new Set(["certified", "needs_review", "missing", "rejected"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sanitizeInteger(value: unknown) {
  const n = sanitizeNumber(value);
  return n === null ? null : Math.round(n);
}

function sanitizeStatus(value: unknown) {
  return typeof value === "string" && RECORD_STATUSES.has(value) ? value : null;
}

function isUniqueConflictError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guardResponse = guardMutationRequest(request);
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service: supabase } = access;

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "수정할 기록을 다시 선택해주세요." }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, string | number | null> = {};

  if (typeof body.participant_id === "string") patch.participant_id = body.participant_id;
  if (typeof body.record_date === "string") patch.record_date = body.record_date;
  if (typeof body.record_date === "string" && !isWithinFourthSeasonWindow(body.record_date)) {
    return NextResponse.json({ error: FOURTH_SEASON_DATE_ERROR }, { status: 400 });
  }
  if ("distance_km" in body) patch.distance_km = sanitizeNumber(body.distance_km);
  if ("duration_seconds" in body) patch.duration_seconds = sanitizeInteger(body.duration_seconds);
  if ("source_app" in body) patch.source_app = body.source_app || null;
  if ("status" in body) {
    const status = sanitizeStatus(body.status);
    if (!status) return NextResponse.json({ error: "기록 상태값을 다시 확인해주세요." }, { status: 400 });
    patch.status = status;
  }
  if ("notes" in body) patch.notes = body.notes || null;

  if (typeof patch.participant_id === "string") {
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id")
      .eq("id", patch.participant_id)
      .eq("user_id", user.id)
      .eq("season_key", FOURTH_SEASON_KEY)
      .eq("active", true)
      .maybeSingle();

    if (participantError) {
      logServerFailure("Record participant validation", participantError);
      return NextResponse.json({ error: "멤버 정보를 확인하지 못했어요." }, { status: 500 });
    }
    if (!participant) {
      return NextResponse.json({ error: "활성 멤버를 찾지 못했어요. 멤버 목록을 새로고침해주세요." }, { status: 400 });
    }
  }

  const distanceProvided = "distance_km" in body;
  const durationProvided = "duration_seconds" in body;
  const distanceKm = distanceProvided ? sanitizeNumber(body.distance_km) : null;
  const durationSeconds = durationProvided ? sanitizeInteger(body.duration_seconds) : null;
  if ("pace_seconds_per_km" in body) {
    patch.pace_seconds_per_km = sanitizeInteger(body.pace_seconds_per_km);
  } else if (distanceProvided || durationProvided) {
    patch.pace_seconds_per_km = calculatePaceSeconds(distanceKm, durationSeconds);
  }

  const { error } = await supabase
    .from("daily_run_records")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("season_key", FOURTH_SEASON_KEY);

  if (error) {
    logServerFailure("Record update", error);
    if (isUniqueConflictError(error)) {
      return NextResponse.json({ error: "이미 그 멤버의 같은 날짜 기록이 있어요. 기존 기록을 먼저 확인해주세요." }, { status: 409 });
    }
    return NextResponse.json({ error: "러닝 기록을 수정하지 못했어요." }, { status: 500 });
  }

  invalidatePublicDashboardCache();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guardResponse = guardMutationRequest(request);
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service: supabase } = access;

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "삭제할 기록을 다시 선택해주세요." }, { status: 400 });
  }
  const { error } = await supabase
    .from("daily_run_records")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("season_key", FOURTH_SEASON_KEY);

  if (error) {
    logServerFailure("Record delete", error);
    return NextResponse.json({ error: "러닝 기록을 삭제하지 못했어요." }, { status: 500 });
  }

  invalidatePublicDashboardCache();

  return NextResponse.json({ success: true });
}
