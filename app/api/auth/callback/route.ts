import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

/**
 * GET /api/auth/callback
 *
 * Google 로그인 완료 후:
 * - Strava 연동이 안 되어 있으면 → 자동으로 Strava 인증 시작
 * - Strava 연동이 되어 있으면 → 대시보드로 이동
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Strava 연동 여부 확인 (쿠키)
      const cookieStore = await cookies();
      const stravaSession = cookieStore.get("oriwan_session");

      if (!stravaSession) {
        // Strava 미연동 → 자동으로 Strava OAuth 시작
        return NextResponse.redirect(`${origin}/api/auth/strava`);
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}?error=auth_failed`);
}
