import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculatePaceSeconds } from "@/lib/run-records";
import { CHALLENGE_DATE_ERROR, isWithinChallengeWindow } from "@/lib/challenge";
import { findAdminUserId, findParticipantByRunnerName, getServiceClient } from "@/lib/admin-data";

function sanitizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasPositiveMetric(value: number | null) {
  return Boolean(value && value > 0);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "내 기록을 올리려면 먼저 로그인해주세요." }, { status: 401 });

  const runnerName = typeof user.user_metadata?.runner_name === "string" ? user.user_metadata.runner_name : "";
  if (!runnerName.trim()) return NextResponse.json({ error: "먼저 이름을 연결해주세요." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const recordDate = typeof body.record_date === "string" ? body.record_date : "";
  const distanceKm = sanitizeNumber(body.distance_km);
  const durationSeconds = sanitizeNumber(body.duration_seconds);
  const paceSeconds = calculatePaceSeconds(distanceKm, durationSeconds);

  if (!isWithinChallengeWindow(recordDate)) {
    return NextResponse.json({ error: CHALLENGE_DATE_ERROR }, { status: 400 });
  }
  if (!hasPositiveMetric(distanceKm) && !hasPositiveMetric(durationSeconds)) {
    return NextResponse.json({ error: "거리 또는 시간 중 하나는 입력해주세요." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "서버 환경변수가 설정되지 않았습니다." }, { status: 500 });

  const adminUserId = await findAdminUserId(service);
  if (!adminUserId) return NextResponse.json({ error: "관리자 계정을 찾지 못했습니다." }, { status: 404 });

  const participant = await findParticipantByRunnerName(service, adminUserId, runnerName);
  if (!participant) {
    return NextResponse.json({ error: "등록한 이름이 어드민의 멤버 이름과 달라요. 띄어쓰기까지 맞춰주세요." }, { status: 404 });
  }

  const { data, error: saveError } = await service
    .from("daily_run_records")
    .upsert(
      {
        user_id: adminUserId,
        participant_id: participant.id,
        record_date: recordDate,
        distance_km: distanceKm,
        duration_seconds: durationSeconds,
        pace_seconds_per_km: paceSeconds,
        source_app: "participant_self",
        status: "certified",
        notes: typeof body.notes === "string" ? body.notes : null,
      },
      { onConflict: "user_id,participant_id,record_date" }
    )
    .select("id")
    .single();

  if (saveError) {
    console.error("Participant self record save error:", saveError);
    return NextResponse.json({ error: "기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id, participant });
}
