export const CERTIFICATION_DISPLAY_START_DATE = "2026-05-01";
export const CHALLENGE_START_DATE = "2026-05-05";
export const CHALLENGE_DAYS = 100;
export const CHALLENGE_END_DATE = "2026-08-12";
export const CHALLENGE_DATE_ERROR = `실제 인증일은 ${CHALLENGE_START_DATE}부터 ${CHALLENGE_END_DATE}까지 입력할 수 있습니다.`;

export function clampToChallengeStart(date: string) {
  return date < CHALLENGE_START_DATE ? CHALLENGE_START_DATE : date;
}

export function clampToChallengeWindow(date: string) {
  if (date < CHALLENGE_START_DATE) return CHALLENGE_START_DATE;
  if (date > CHALLENGE_END_DATE) return CHALLENGE_END_DATE;
  return date;
}

export function isWithinChallengeWindow(date: string | null | undefined) {
  return Boolean(date && date >= CHALLENGE_START_DATE && date <= CHALLENGE_END_DATE);
}

export function normalizeRunnerName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
