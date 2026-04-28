import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/completions
 * 이번 달 완료 기록 조회 (서버 사이드 — anon key 노출 방지)
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
    return NextResponse.json({ error: "기록 조회 중 오류가 발생했어요." }, { status: 500 });
  }

  return NextResponse.json({ completions: data || [] });
}
