import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getValidAccessToken,
  getTodayActivities,
  getActivityDetail,
} from "@/lib/strava";

/**
 * GET /api/strava/activities
 *
 * 오늘의 러닝 활동을 Strava에서 가져옵니다.
 * ⚠️ 서버 사이드에서만 Strava API를 호출하고, 클라이언트에는 필요한 데이터만 반환합니다.
 */
export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("oriwan_session")?.value;

  if (!sessionCookie) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const session = JSON.parse(sessionCookie);

    // 토큰 유효성 확인 및 자동 갱신
    const tokenInfo = await getValidAccessToken(
      session.access_token,
      session.refresh_token,
      session.expires_at
    );

    // 토큰이 갱신되었으면 쿠키도 업데이트
    if (tokenInfo.refreshed) {
      session.access_token = tokenInfo.access_token;
      session.refresh_token = tokenInfo.refresh_token;
      session.expires_at = tokenInfo.expires_at;

      cookieStore.set("oriwan_session", JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    // 오늘의 러닝 활동 가져오기
    const activities = await getTodayActivities(tokenInfo.access_token);

    if (activities.length === 0) {
      return NextResponse.json({ activities: [], hasRun: false });
    }

    // 첫 번째(최신) 러닝 활동의 상세 데이터 가져오기
    const latestRun = activities[0];
    const detail = await getActivityDetail(
      tokenInfo.access_token,
      latestRun.id
    );

    // 클라이언트에 필요한 데이터만 필터링하여 반환 (보안)
    const safeData = {
      id: detail.id,
      name: detail.name,
      distance: detail.distance, // 미터 단위
      moving_time: detail.moving_time, // 초 단위
      elapsed_time: detail.elapsed_time,
      average_speed: detail.average_speed,
      max_speed: detail.max_speed,
      average_cadence: detail.average_cadence,
      average_heartrate: detail.average_heartrate,
      max_heartrate: detail.max_heartrate,
      total_elevation_gain: detail.total_elevation_gain,
      start_date_local: detail.start_date_local,
      calories: detail.calories,
    };

    return NextResponse.json({
      activities: [safeData],
      hasRun: true,
      totalActivities: activities.length,
    });
  } catch (err) {
    console.error("Strava activities fetch error:", err);
    return NextResponse.json(
      { error: "러닝 데이터를 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
