import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStravaAuthUrl } from "@/lib/strava";

/**
 * GET /api/auth/strava
 *
 * Strava OAuth 인증 플로우를 시작합니다.
 * 브라우저에서 직접 이 URL로 이동하면 Strava 로그인 화면으로 리다이렉트됩니다.
 */
export async function GET(request: NextRequest) {
  try {
    const state = crypto.randomUUID();

    const cookieStore = await cookies();
    cookieStore.set("strava_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const origin = new URL(request.url).origin;
    const authUrl = getStravaAuthUrl(state, origin);

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("Strava auth error:", err);
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/dashboard?error=strava_init_failed`);
  }
}
