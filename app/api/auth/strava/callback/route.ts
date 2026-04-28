import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeStravaCode } from "@/lib/strava";

/**
 * GET /api/auth/strava/callback
 *
 * Strava가 사용자를 인증 후 이 URL로 리다이렉트합니다.
 * 1. CSRF state 토큰을 검증합니다.
 * 2. Authorization Code → Access Token 교환을 수행합니다.
 * 3. 토큰 정보를 httpOnly 쿠키에 안전하게 저장합니다 (서버만 접근 가능).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // 사용자가 권한 동의를 거부한 경우
  if (error) {
    return NextResponse.redirect(`${appUrl}?error=strava_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}?error=invalid_request`);
  }

  // ===== CSRF 검증 =====
  const cookieStore = await cookies();
  const savedState = cookieStore.get("strava_oauth_state")?.value;

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}?error=csrf_mismatch`);
  }

  // state 쿠키 소비 (재사용 방지)
  cookieStore.delete("strava_oauth_state");

  try {
    // ===== 토큰 교환 =====
    const tokenData = await exchangeStravaCode(code);

    // Access Token, Refresh Token, 운동선수 정보를 httpOnly 쿠키에 저장
    // ⚠️ 중요: 이 토큰들은 절대 클라이언트 JS에 노출되지 않습니다.
    const sessionData = JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete: {
        id: tokenData.athlete.id,
        firstname: tokenData.athlete.firstname,
        lastname: tokenData.athlete.lastname,
        profile: tokenData.athlete.profile,
      },
    });

    cookieStore.set("oriwan_session", sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30일
      path: "/",
    });

    // 공개 정보만 담긴 쿠키 (프론트에서 UI 표시용)
    cookieStore.set(
      "oriwan_user",
      JSON.stringify({
        id: tokenData.athlete.id,
        name: `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`,
        profile: tokenData.athlete.profile,
      }),
      {
        httpOnly: false, // 클라이언트에서 이름, 프로필 사진 표시용
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      }
    );

    return NextResponse.redirect(`${appUrl}/dashboard`);
  } catch (err) {
    console.error("Strava OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}?error=token_exchange_failed`);
  }
}
