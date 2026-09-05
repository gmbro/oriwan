import "server-only";

export const KAKAO_AUTH_START_COOKIE = "twtt-kakao-auth-start";
export const KAKAO_AUTH_RETURN_COOKIE = "twtt-kakao-auth-return";
export const KAKAO_AUTH_START_COOKIE_PATH = "/api/auth";
// Keep one PKCE flow authoritative while the user completes Kakao consent.
// A deliberate retry can replace it through `restart=1` on the start route.
export const KAKAO_AUTH_START_TTL_SECONDS = 5 * 60;
export const KAKAO_AUTH_RETURN_TTL_SECONDS = 10 * 60;

export function kakaoAuthStartCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: KAKAO_AUTH_START_COOKIE_PATH,
    priority: "high" as const,
  };
}
