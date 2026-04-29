import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/completions — 월간 완료 기록 조회
 * POST /api/completions — 운동 완료 기록 저장
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  const now = new Date();
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

  const daysInMonth = new Date(year, month, 0).getDate();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${daysInMonth}`;

  const { data, error } = await supabase
    .from("completions")
    .select("id, completed_date")
    .eq("user_id", user.id)
    .gte("completed_date", startDate)
    .lte("completed_date", endDate);

  if (error) {
    console.error("Completions query error:", error);
    return NextResponse.json({ error: "기록 조회 중 오류" }, { status: 500 });
  }

  return NextResponse.json({ completions: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { duration, photo_url } = await request.json();

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const { error } = await supabase
      .from("completions")
      .upsert(
        {
          user_id: user.id,
          completed_date: todayStr,
          moving_time: duration || 0,
          photo_url: photo_url || null,
          certified: true,
        },
        { onConflict: "user_id,completed_date" }
      );

    if (error) {
      console.error("Completion save error:", error);
      return NextResponse.json({ error: "기록 저장 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true, date: todayStr });
  } catch (err) {
    console.error("Completion error:", err);
    return NextResponse.json({ error: "기록 저장 중 오류" }, { status: 500 });
  }
}
