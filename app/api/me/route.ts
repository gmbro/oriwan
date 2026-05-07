import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_END_DATE, CHALLENGE_START_DATE } from "@/lib/challenge";
import { findAdminUserId, findParticipantByRunnerName, getServiceClient } from "@/lib/admin-data";

function getRunnerName(userMetadata: Record<string, unknown> | null | undefined) {
  const value = userMetadata?.runner_name;
  return typeof value === "string" ? value : "";
}

async function buildMePayload(userId: string, email: string | undefined, userMetadata: Record<string, unknown> | null | undefined) {
  const service = getServiceClient();
  if (!service) throw new Error("service_missing");

  const runnerName = getRunnerName(userMetadata);
  const adminUserId = await findAdminUserId(service);
  const participant = adminUserId && runnerName ? await findParticipantByRunnerName(service, adminUserId, runnerName) : null;

  let records: unknown[] = [];
  if (adminUserId && participant) {
    const { data, error } = await service
      .from("daily_run_records")
      .select("id, participant_id, record_date, distance_km, duration_seconds, pace_seconds_per_km, status, source_app, notes, created_at")
      .eq("user_id", adminUserId)
      .eq("participant_id", participant.id)
      .gte("record_date", CHALLENGE_START_DATE)
      .order("record_date", { ascending: false });
    if (error) throw error;
    records = data || [];
  }

  return {
    user: { id: userId, email },
    runner_name: runnerName,
    matched_participant: participant,
    records,
    certification_display_start_date: CERTIFICATION_DISPLAY_START_DATE,
    challenge_start_date: CHALLENGE_START_DATE,
    challenge_end_date: CHALLENGE_END_DATE,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "내 러닝 보드를 보려면 먼저 로그인해주세요." }, { status: 401 });

  try {
    return NextResponse.json(await buildMePayload(user.id, user.email, user.user_metadata));
  } catch (err) {
    console.error("Me profile error:", err);
    return NextResponse.json({ error: "내 러닝 보드를 불러오지 못했어요." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "이름을 연결하려면 먼저 로그인해주세요." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const runnerName = typeof body.runner_name === "string" ? body.runner_name.trim().replace(/\s+/g, " ") : "";
  if (!runnerName) return NextResponse.json({ error: "기록을 연결하려면 이름이 꼭 필요해요." }, { status: 400 });

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "서버 환경변수가 설정되지 않았습니다." }, { status: 500 });

  const userMetadata = {
    ...(user.user_metadata || {}),
    runner_name: runnerName,
  };

  const { error: updateError } = await service.auth.admin.updateUserById(user.id, {
    user_metadata: userMetadata,
  });
  if (updateError) return NextResponse.json({ error: "이름을 저장하지 못했어요." }, { status: 500 });

  try {
    return NextResponse.json(await buildMePayload(user.id, user.email, userMetadata));
  } catch (err) {
    console.error("Me profile update payload error:", err);
    return NextResponse.json({ error: "이름은 저장했지만 연결 정보를 불러오지 못했어요." }, { status: 500 });
  }
}
