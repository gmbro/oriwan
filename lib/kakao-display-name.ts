import "server-only";

type KakaoLikeUser = {
  identities?: Array<{
    provider?: string;
    identity_data?: Record<string, unknown>;
  }>;
  user_metadata?: Record<string, unknown>;
};

function normalizedName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value
    .replace(/[\u0000-\u001f\u007f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return name.length >= 2 && name.length <= 40 ? name : null;
}

function normalizedProfileImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return url.length > 0 && url.length <= 2_048 ? url : null;
}

function getKakaoIdentityData(user: KakaoLikeUser) {
  const kakaoIdentity = user.identities?.find((identity) => identity.provider === "kakao");
  return {
    ...(user.user_metadata || {}),
    ...(kakaoIdentity?.identity_data || {}),
  };
}

function recordValue(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function getKakaoDisplayName(user: KakaoLikeUser) {
  // Verified access-token claims expose Kakao profile fields as user_metadata,
  // while getUser() exposes the same fields on the provider identity. Supporting
  // both lets request-time pages use local JWT verification without weakening the
  // authorization decision, which still comes from verified app_metadata.
  const identityData = getKakaoIdentityData(user);
  const account = identityData.kakao_account;
  const profile = account && typeof account === "object"
    ? (account as Record<string, unknown>).profile
    : null;
  const profileNickname = profile && typeof profile === "object"
    ? (profile as Record<string, unknown>).nickname
    : null;

  return [
    identityData.name,
    identityData.full_name,
    identityData.nickname,
    identityData.preferred_username,
    profileNickname,
  ].map(normalizedName).find(Boolean) || null;
}

/** Returns Kakao's optional image URL; the storage importer performs the URL allowlist validation. */
export function getKakaoProfileImageUrl(user: KakaoLikeUser) {
  const identityData = getKakaoIdentityData(user);
  const accountData = recordValue(identityData.kakao_account);
  const profileData = recordValue(accountData.profile);
  const normalizedProfileData = recordValue(identityData.profile);
  const propertiesData = recordValue(identityData.properties);

  return [
    profileData.profile_image_url,
    profileData.thumbnail_image_url,
    normalizedProfileData.profile_image_url,
    normalizedProfileData.thumbnail_image_url,
    propertiesData.profile_image,
    propertiesData.thumbnail_image,
    identityData.profile_image_url,
    identityData.thumbnail_image_url,
    identityData.avatar_url,
    identityData.picture,
  ].map(normalizedProfileImageUrl).find(Boolean) || null;
}
