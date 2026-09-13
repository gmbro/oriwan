export const DEFAULT_HELLO_2027_BANNER_CLICK_URL = "https://www.naver.com/";
export const MAX_HELLO_2027_BANNER_CLICK_URL_LENGTH = 2_048;

const UNSAFE_URL_PATTERN = /[\u0000-\u0020\u007f-\u009f\\\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;

/** Only navigable HTTPS URLs without embedded credentials are accepted. */
export function isSafeHello2027BannerClickUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > MAX_HELLO_2027_BANNER_CLICK_URL_LENGTH
    || UNSAFE_URL_PATTERN.test(normalized)
  ) {
    return false;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
