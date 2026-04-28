import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/callback
 *
 * Supabase Google OAuth 콜백.
 * 로그인 완료 후:
 * - Strava 연동이 안 되어 있으면 → 대시보드로 이동 (대시보드에서 Strava 연동 유도)
 * - Strava 연동이 되어 있으면 → 대시보드로 이동
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}?error=auth_failed`);
}
