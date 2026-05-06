import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin-server";
import { calculatePaceSeconds } from "@/lib/run-records";
import { CHALLENGE_DATE_ERROR, isWithinChallengeWindow } from "@/lib/challenge";

function sanitizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
  if ("status" in body) patch.status = body.status;
  if ("notes" in body) patch.notes = body.notes || null;

  const distanceKm = "distance_km" in body ? sanitizeNumber(body.distance_km) : null;
  const durationSeconds = "duration_seconds" in body ? sanitizeNumber(body.duration_seconds) : null;
  if ("pace_seconds_per_km" in body) {
    patch.pace_seconds_per_km = sanitizeNumber(body.pace_seconds_per_km);
  } else if (distanceKm && durationSeconds) {
    patch.pace_seconds_per_km = calculatePaceSeconds(distanceKm, durationSeconds);
  }

  const { error } = await supabase
    .from("daily_run_records")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Record update error:", error);
    return NextResponse.json({ error: "기록 수정 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    return NextResponse.json({ error: "기록 삭제 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
