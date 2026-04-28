import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStravaAuthUrl } from "@/lib/strava";

/**
 * GET /api/auth/strava
 *
 * Strava OAuth 인증 플로우를 시작합니다.
 * CSRF 방지용 state 토큰 생성 후, 인증 URL을 JSON으로 반환합니다.
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

    // 클라이언트에서 fetch로 호출하므로 JSON으로 URL 반환
    return NextResponse.json({ url: authUrl });
  } catch (err) {
    console.error("Strava auth error:", err);
    return NextResponse.json({ error: "Strava 연동 준비 중 오류가 발생했어요." }, { status: 500 });
  }
}
