export const DEFAULT_HELLO_2027_PROFILE_IMAGE_URL =
  "/images/poc/hello-2027/default-profile-avatar.webp";

/**
 * Resolves only the display fallback. Persisted member/admin uploads and copied
 * Kakao images always take precedence; the default asset is never written to a
 * participant's storage slot.
 */
export function resolveHello2027ProfileImageUrl(value: unknown) {
  if (typeof value !== "string") return DEFAULT_HELLO_2027_PROFILE_IMAGE_URL;
  const normalized = value.trim();
  return normalized || DEFAULT_HELLO_2027_PROFILE_IMAGE_URL;
}
