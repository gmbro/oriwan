import "server-only";

type KakaoLikeUser = {
  identities?: Array<{
    provider?: string;
    identity_data?: Record<string, unknown>;
  }>;
};

function normalizedName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value
    .replace(/[\u0000-\u001f\u007f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return name.length >= 2 && name.length <= 40 ? name : null;
}

export function getKakaoDisplayName(user: KakaoLikeUser) {
  const kakaoIdentity = user.identities?.find((identity) => identity.provider === "kakao");
  const identityData = kakaoIdentity?.identity_data || {};
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
