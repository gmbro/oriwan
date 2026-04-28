import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeStravaCode } from "@/lib/strava";

/**
 * GET /api/auth/strava/callback
 *
 * Strava OAuth 콜백 처리.
 * 1. CSRF state 토큰 검증
 * 2. Authorization Code → Access Token 교환
 * 3. 토큰을 httpOnly 쿠키에 저장 (서버만 접근 가능)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const origin = new URL(request.url).origin;

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard?error=strava_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/dashboard?error=invalid_request`);
  }

  // CSRF 검증
  const cookieStore = await cookies();
  const savedState = cookieStore.get("strava_oauth_state")?.value;

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${origin}/dashboard?error=csrf_mismatch`);
  }

  cookieStore.delete("strava_oauth_state");

  try {
    const tokenData = await exchangeStravaCode(code);

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
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    cookieStore.set(
      "oriwan_user",
      JSON.stringify({
        id: tokenData.athlete.id,
        name: `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`,
        profile: tokenData.athlete.profile,
      }),
      {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      }
    );

    return NextResponse.redirect(`${origin}/dashboard`);
  } catch (err) {
    console.error("Strava OAuth callback error:", err);
    return NextResponse.redirect(`${origin}/dashboard?error=token_exchange_failed`);
  }
}
