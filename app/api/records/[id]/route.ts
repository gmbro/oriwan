import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin-server";
import { calculatePaceSeconds } from "@/lib/run-records";
import { CHALLENGE_DATE_ERROR, isWithinChallengeWindow } from "@/lib/challenge";
import { guardMutationRequest } from "@/lib/request-security";

const RECORD_STATUSES = new Set(["certified", "needs_review", "missing", "rejected"]);

function sanitizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, string | number | null> = {};

  if (typeof body.participant_id === "string") patch.participant_id = body.participant_id;
  if (typeof body.record_date === "string") patch.record_date = body.record_date;
  if (typeof body.record_date === "string" && !isWithinChallengeWindow(body.record_date)) {
    return NextResponse.json({ error: CHALLENGE_DATE_ERROR }, { status: 400 });
  }
  if ("distance_km" in body) patch.distance_km = sanitizeNumber(body.distance_km);
  if ("duration_seconds" in body) patch.duration_seconds = sanitizeNumber(body.duration_seconds);
  if ("source_app" in body) patch.source_app = body.source_app || null;
  if ("status" in body) {
    const status = sanitizeStatus(body.status);
    if (!status) return NextResponse.json({ error: "기록 상태값을 다시 확인해주세요." }, { status: 400 });
    patch.status = status;
  }
  if ("notes" in body) patch.notes = body.notes || null;

  const distanceProvided = "distance_km" in body;
  const durationProvided = "duration_seconds" in body;
  const distanceKm = distanceProvided ? sanitizeNumber(body.distance_km) : null;
  const durationSeconds = durationProvided ? sanitizeNumber(body.duration_seconds) : null;
  if ("pace_seconds_per_km" in body) {
    patch.pace_seconds_per_km = sanitizeNumber(body.pace_seconds_per_km);
  } else if (distanceProvided || durationProvided) {
    patch.pace_seconds_per_km = calculatePaceSeconds(distanceKm, durationSeconds);
  }

  const { error } = await supabase
    .from("daily_run_records")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Record update error:", error);
    if (isUniqueConflictError(error)) {
      return NextResponse.json({ error: "이미 그 멤버의 같은 날짜 기록이 있어요. 기존 기록을 먼저 확인해주세요." }, { status: 409 });
    }
    return NextResponse.json({ error: "러닝 기록을 수정하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guardResponse = guardMutationRequest(request);
  if (guardResponse) return guardResponse;

  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  const { id } = await context.params;
  const { error } = await supabase
    .from("daily_run_records")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Record delete error:", error);
    return NextResponse.json({ error: "러닝 기록을 삭제하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
