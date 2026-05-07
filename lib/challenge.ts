export const CERTIFICATION_DISPLAY_START_DATE = "2026-05-01";
export const ACTUAL_CERTIFICATION_START_DATE = "2026-05-05";
export const CHALLENGE_START_DATE = "2026-05-01";
export const CHALLENGE_DAYS = 100;
export const CHALLENGE_END_DATE = "2026-08-08";
export const CHALLENGE_DATE_ERROR = `러닝 기록은 ${CHALLENGE_START_DATE}부터 ${CHALLENGE_END_DATE}까지만 남길 수 있어요.`;

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
