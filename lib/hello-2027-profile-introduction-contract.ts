export const MAX_HELLO_2027_PROFILE_INTRODUCTIONS = 100;
export const MAX_PROFILE_INTRO_NAME_LENGTH = 40;
export const MAX_PROFILE_INTRO_TITLE_LENGTH = 40;
export const MAX_PROFILE_INTRO_LENGTH = 320;

// Preserve emoji joiners (ZWJ/ZWNJ); discard pasted control and direction marks.
// The editor, write API and public reader share this normalization.
export function normalizeProfileIntroduction(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/gu, "")
    .replace(/\s+/gu, " ").trim();
}
