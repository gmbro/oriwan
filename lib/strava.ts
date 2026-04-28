/**
 * Strava API 연동 유틸리티
 *
 * 보안 원칙:
 * - Client Secret과 Access Token은 **서버 사이드(API Route)에서만** 사용합니다.
 * - 클라이언트(브라우저)에는 절대 노출하지 않습니다.
 * - Refresh Token을 Supabase DB(서버)에 안전하게 저장하고, 만료 시 자동 갱신합니다.
 */

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

/**
 * Strava OAuth 인증 URL을 생성합니다.
 * 사용자가 이 URL로 이동하면 스트라바 로그인 및 권한 동의 화면이 표시됩니다.
 */
export function getStravaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: process.env.NEXT_PUBLIC_STRAVA_REDIRECT_URI!,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state, // CSRF 방지를 위한 랜덤 토큰
  });

  return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

/**
 * 인증 코드를 사용하여 Access Token과 Refresh Token을 교환합니다.
 * 서버 사이드 전용 함수입니다.
 */
export async function exchangeStravaCode(code: string) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Strava token exchange failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Refresh Token을 사용하여 만료된 Access Token을 갱신합니다.
 * 서버 사이드 전용 함수입니다.
 */
export async function refreshStravaToken(refreshToken: string) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Strava token refresh failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 유효한 Access Token을 가져옵니다 (만료 시 자동 갱신).
 */
export async function getValidAccessToken(
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): Promise<{ access_token: string; refresh_token: string; expires_at: number; refreshed: boolean }> {
  const now = Math.floor(Date.now() / 1000);

  if (expiresAt > now + 60) {
    // 아직 만료 1분 전이면 기존 토큰 사용
    return { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt, refreshed: false };
  }

  // 만료되었거나 임박하면 갱신
  const data = await refreshStravaToken(refreshToken);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    refreshed: true,
  };
}

/**
 * 오늘의 러닝 활동 목록을 가져옵니다.
 */
export async function getTodayActivities(accessToken: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const after = Math.floor(todayStart.getTime() / 1000);

  const response = await fetch(
    `${STRAVA_API_BASE}/athlete/activities?after=${after}&per_page=10`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Strava API error: ${response.statusText}`);
  }

  const activities = await response.json();

  // 러닝(Run) 활동만 필터
  return activities.filter(
    (a: { type: string }) => a.type === "Run" || a.type === "VirtualRun"
  );
}

/**
 * 특정 활동의 상세 정보 (케이던스 등 포함)를 가져옵니다.
 */
export async function getActivityDetail(accessToken: string, activityId: number) {
  const response = await fetch(
    `${STRAVA_API_BASE}/activities/${activityId}?include_all_efforts=false`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Strava activity detail error: ${response.statusText}`);
  }

  return response.json();
}
