export const CHALLENGE_START_DATE = "2026-05-05";

export function clampToChallengeStart(date: string) {
  return date < CHALLENGE_START_DATE ? CHALLENGE_START_DATE : date;
}

export function normalizeRunnerName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
