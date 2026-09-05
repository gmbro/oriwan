const AUTH_RETURN_PATHS = new Set(["/", "/4th", "/4th/dashboard", "/me"]);
const UNSAFE_PATH_CHARACTERS = /[\\\u0000-\u001f\u007f]/;
type AuthReturnFallback = "/" | "/4th" | "/4th/dashboard" | "/4th/dashboard#member-features" | "/me";

/**
 * OAuth 복귀 위치는 제품에서 실제로 쓰는 내부 화면만 허용합니다.
 * URL 파서가 탭·개행을 제거한 뒤 외부 호스트로 해석하는 우회도 원문 단계에서 차단합니다.
 */
export function getSafeAuthReturnPath(
  value: string | null | undefined,
  fallback: AuthReturnFallback = "/4th",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || UNSAFE_PATH_CHARACTERS.test(value)) {
    return fallback;
  }

  try {
    const base = new URL("https://twtt.invalid");
    const target = new URL(value, base);
    if (target.origin !== base.origin || target.search || !AUTH_RETURN_PATHS.has(target.pathname)) {
      return fallback;
    }

    const allowedHash = target.hash === "" || (target.pathname === "/4th/dashboard" && target.hash === "#member-features");
    return allowedHash ? `${target.pathname}${target.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function getSafeAuthReturnUrl(
  value: string | null | undefined,
  origin: string,
  fallback: AuthReturnFallback = "/4th",
) {
  const expectedOrigin = new URL(origin).origin;
  const target = new URL(getSafeAuthReturnPath(value, fallback), expectedOrigin);
  return target.origin === expectedOrigin ? target : new URL(fallback, expectedOrigin);
}
