import { NextRequest, NextResponse } from "next/server";
import { addDays, toIsoDate } from "@/lib/run-records";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import { CHALLENGE_START_DATE, clampToChallengeStart } from "@/lib/challenge";
import { findAdminUserId, getServiceClient } from "@/lib/admin-data";

export async function GET(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "공개 대시보드 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get("days") || 30);
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 7), 100) : 30;
  const to = toIsoDate(new Date());
  const from = clampToChallengeStart(toIsoDate(addDays(new Date(), -(days - 1))));

  try {
    const adminUserId = await findAdminUserId(supabase);
    if (!adminUserId) {
      return NextResponse.json({ error: "관리자 계정을 찾지 못했습니다." }, { status: 404 });
    }

    const [participantsResult, recordsResult] = await Promise.all([
      supabase
        .from("participants")
        .select("id, name, nickname, active, display_order, created_at")
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
          participants(id, name, nickname)
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
        generated_at: new Date().toISOString(),
        participants: [],
        records: [],
        ...missingSchemaResponse("Supabase에 참가자/기록 테이블을 먼저 만들어야 합니다."),
      });
    }

    if (participantsResult.error) throw participantsResult.error;
    if (recordsResult.error) throw recordsResult.error;

    return NextResponse.json({
      from,
      to,
      challenge_start_date: CHALLENGE_START_DATE,
      generated_at: new Date().toISOString(),
      participants: participantsResult.data || [],
      records: recordsResult.data || [],
    });
  } catch (error) {
    console.error("Public dashboard error:", error);
    return NextResponse.json({ error: "공개 대시보드 조회 실패" }, { status: 500 });
  }
}
