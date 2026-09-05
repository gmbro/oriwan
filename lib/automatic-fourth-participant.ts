import { createHash } from "node:crypto";

export function normalizeAutomaticFourthParticipantName(value: string | null | undefined) {
  const normalized = value
    ?.replace(/[\u0000-\u001f\u007f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

  return normalized && normalized.length >= 2 ? normalized : "카카오 러너";
}

export function getAutomaticFourthParticipantId(authUserId: string, seasonKey: string) {
  const bytes = createHash("sha256")
    .update(`twtt:${seasonKey}:${authUserId}`)
    .digest()
    .subarray(0, 16);

  // A stable UUID keeps simultaneous first requests idempotent without exposing
  // the authenticated user id or relying on a user-editable Kakao nickname.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
