import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin-server";
import { calculatePaceSeconds } from "@/lib/run-records";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import { CHALLENGE_DATE_ERROR, isWithinChallengeWindow } from "@/lib/challenge";

function sanitizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("daily_run_records")
    .select(`
      id,
      participant_id,
      record_date,
      distance_km,
      duration_seconds,
      pace_seconds_per_km,
      source_app,
      status,
      confidence_score,
      image_url,
      raw_extracted_text,
      notes,
      created_at,
      participants(id, name)
    `)
    .eq("user_id", user.id)
    .order("record_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (from) query = query.gte("record_date", from);
  if (to) query = query.lte("record_date", to);

  const { data, error } = await query;

  if (error) {
    console.error("Records query error:", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("러닝 기록 테이블이 아직 준비되지 않았어요."), { status: 503 });
    }
    return NextResponse.json({ error: "러닝 기록을 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ records: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const participantId = typeof body.participant_id === "string" ? body.participant_id : null;
  const recordDate = typeof body.record_date === "string" ? body.record_date : null;
  const distanceKm = sanitizeNumber(body.distance_km);
  const durationSeconds = sanitizeNumber(body.duration_seconds);
  const paceSeconds = sanitizeNumber(body.pace_seconds_per_km) ?? calculatePaceSeconds(distanceKm, durationSeconds);

  if (!participantId || !recordDate) {
    return NextResponse.json({ error: "멤버와 날짜를 함께 선택해주세요." }, { status: 400 });
  }
  if (!isWithinChallengeWindow(recordDate)) {
    return NextResponse.json({ error: CHALLENGE_DATE_ERROR }, { status: 400 });
  }

  const status = body.status || (distanceKm && durationSeconds ? "certified" : "needs_review");
  const { data, error } = await supabase
    .from("daily_run_records")
    .upsert(
      {
        user_id: user.id,
        participant_id: participantId,
        record_date: recordDate,
        distance_km: distanceKm,
        duration_seconds: durationSeconds,
        pace_seconds_per_km: paceSeconds,
        source_app: body.source_app || null,
        status,
        confidence_score: sanitizeNumber(body.confidence_score),
        image_url: body.image_url || null,
        raw_extracted_text: body.raw_extracted_text || null,
        notes: body.notes || null,
      },
      { onConflict: "user_id,participant_id,record_date" }
    )
    .select("id")
    .single();

  if (error) {
    console.error("Record save error:", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("러닝 기록 테이블이 아직 준비되지 않았어요."), { status: 503 });
    }
    return NextResponse.json({ error: "러닝 기록을 저장하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
