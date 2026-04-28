import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/logout
 * 세션을 정리하고 로그아웃합니다.
 */
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });

  // Strava 관련 쿠키도 정리
  response.cookies.delete("oriwan_session");
  response.cookies.delete("oriwan_user");

  return response;
}
