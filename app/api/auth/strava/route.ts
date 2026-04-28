import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStravaAuthUrl } from "@/lib/strava";

/**
 * GET /api/auth/strava
 *
 * Strava OAuth 인증 플로우를 시작합니다.
 * CSRF 공격 방지를 위해 랜덤 state 토큰을 생성하여 쿠키에 저장합니다.
 */
export async function GET(request: NextRequest) {
  // CSRF 방지용 랜덤 state 토큰 생성
  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set("strava_oauth_state", state, {
    httpOnly: true,     // JS에서 접근 불가 (XSS 방지)
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,        // 10분 유효
    path: "/",
  });

  // 현재 요청의 origin을 사용하여 redirect_uri를 동적으로 생성
  const origin = new URL(request.url).origin;
  const authUrl = getStravaAuthUrl(state, origin);
  return NextResponse.redirect(authUrl);
}
