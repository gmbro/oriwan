import { NextRequest, NextResponse } from "next/server";
import { addDays, toIsoDate } from "@/lib/run-records";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import { CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_END_DATE, CHALLENGE_START_DATE, clampToChallengeStart } from "@/lib/challenge";
import { findAdminUserId, getServiceClient } from "@/lib/admin-data";

export async function GET(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "공개 대시보드 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const daysParam = Number(searchParams.get("days") || 30);
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 7), 366) : 30;
  const today = toIsoDate(new Date());
  const to = today;
  const rangeEnd = new Date(`${to}T00:00:00`);
  const from = scope === "all" ? CHALLENGE_START_DATE : clampToChallengeStart(toIsoDate(addDays(rangeEnd, -(days - 1))));

  try {
    const adminUserId = await findAdminUserId(supabase);
    if (!adminUserId) {
      return NextResponse.json({ error: "관리자 계정을 찾지 못했습니다." }, { status: 404 });
    }

    const [participantsResult, recordsResult] = await Promise.all([
      supabase
        .from("participants")
        .select("id, name, active, display_order, created_at")
        .eq("user_id", adminUserId)
        .eq("active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("daily_run_records")
        .select(`
          id,
          participant_id,
          record_date,
          distance_km,
          duration_seconds,
          pace_seconds_per_km,
          status,
          participants(id, name)
        `)
        .eq("user_id", adminUserId)
        .gte("record_date", from)
        .lte("record_date", to)
        .order("record_date", { ascending: false }),
    ]);

    if (isMissingTableError(participantsResult.error) || isMissingTableError(recordsResult.error)) {
      return NextResponse.json({
        from,
        to,
        certification_display_start_date: CERTIFICATION_DISPLAY_START_DATE,
        challenge_start_date: CHALLENGE_START_DATE,
        challenge_end_date: CHALLENGE_END_DATE,
        generated_at: new Date().toISOString(),
        participants: [],
        records: [],
        ...missingSchemaResponse("Supabase에 멤버/기록 테이블을 먼저 준비해주세요."),
      });
    }

    if (participantsResult.error) throw participantsResult.error;
    if (recordsResult.error) throw recordsResult.error;

    return NextResponse.json({
      from,
      to,
      certification_display_start_date: CERTIFICATION_DISPLAY_START_DATE,
      challenge_start_date: CHALLENGE_START_DATE,
      challenge_end_date: CHALLENGE_END_DATE,
      generated_at: new Date().toISOString(),
      participants: participantsResult.data || [],
      records: recordsResult.data || [],
    });
  } catch (error) {
    console.error("Public dashboard error:", error);
    return NextResponse.json({ error: "팀 보드를 불러오지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
