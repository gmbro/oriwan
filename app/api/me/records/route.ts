import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculatePaceSeconds } from "@/lib/run-records";
import { CHALLENGE_DATE_ERROR, isWithinChallengeWindow } from "@/lib/challenge";
import { getServiceClient } from "@/lib/admin-data";
import { participantAccountMutationError, resolveParticipantAccount } from "@/lib/participant-account-server";
import { guardMutationRequest } from "@/lib/request-security";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";

function sanitizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sanitizeInteger(value: unknown) {
  const n = sanitizeNumber(value);
  return n === null ? null : Math.round(n);
}

function hasPositiveMetric(value: number | null) {
  return Boolean(value && value > 0);
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request);
  if (guardResponse) return guardResponse;

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "내 기록을 올리려면 먼저 로그인해주세요." }, { status: 401 });

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "서버 환경변수가 설정되지 않았습니다." }, { status: 500 });

  const connection = await resolveParticipantAccount(service, user.id);
  if (connection.status !== "approved" || !connection.adminUserId || !connection.participant) {
    const accessError = participantAccountMutationError(connection);
    return NextResponse.json(accessError.payload, { status: accessError.status });
  }
  const adminUserId = connection.adminUserId;
  const participant = connection.participant;

  const body = await request.json().catch(() => ({}));
  const recordDate = typeof body.record_date === "string" ? body.record_date : "";
  const distanceKm = sanitizeNumber(body.distance_km);
  const durationSeconds = sanitizeInteger(body.duration_seconds);
  const paceSeconds = calculatePaceSeconds(distanceKm, durationSeconds);

  if (!isWithinChallengeWindow(recordDate)) {
    return NextResponse.json({ error: CHALLENGE_DATE_ERROR }, { status: 400 });
  }
  if (!hasPositiveMetric(distanceKm) && !hasPositiveMetric(durationSeconds)) {
    return NextResponse.json({ error: "거리 또는 시간 중 하나는 입력해주세요." }, { status: 400 });
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

  invalidatePublicDashboardCache();

  return NextResponse.json({ success: true, id: data.id, participant });
}
