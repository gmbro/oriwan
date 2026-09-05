import "server-only";

export const KAKAO_AUTH_START_COOKIE = "twtt-kakao-auth-start";
export const KAKAO_AUTH_START_COOKIE_PATH = "/api/auth";
export const KAKAO_AUTH_START_TTL_SECONDS = 30;

export function kakaoAuthStartCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: KAKAO_AUTH_START_COOKIE_PATH,
    priority: "high" as const,
  };
}
