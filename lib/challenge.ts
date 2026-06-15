export const CERTIFICATION_DISPLAY_START_DATE = "2026-05-01";
export const ACTUAL_CERTIFICATION_START_DATE = "2026-05-05";
export const CHALLENGE_START_DATE = "2026-05-01";
export const CHALLENGE_DAYS = 100;
export const CHALLENGE_END_DATE = "2026-08-08";
export const CHALLENGE_DATE_ERROR = `러닝 기록은 ${CHALLENGE_START_DATE}부터 남길 수 있어요.`;
export const CERTIFICATION_EXCLUDED_PARTICIPANT_NAMES = ["수연"];

export function clampToChallengeStart(date: string) {
  return date < CHALLENGE_START_DATE ? CHALLENGE_START_DATE : date;
}

export function clampToChallengeWindow(date: string) {
  if (date < CHALLENGE_START_DATE) return CHALLENGE_START_DATE;
  return date;
}

export function isWithinChallengeWindow(date: string | null | undefined) {
  return Boolean(date && date >= CHALLENGE_START_DATE);
}

export function normalizeRunnerName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeCertificationParticipantName(name: string) {
  return name.trim().replace(/\s+/g, "").replace(/님$/, "").toLowerCase();
}

export function isCertificationExcludedParticipantName(name: string) {
  const normalized = normalizeCertificationParticipantName(name);
  return CERTIFICATION_EXCLUDED_PARTICIPANT_NAMES.some(
    (excludedName) => normalizeCertificationParticipantName(excludedName) === normalized
  );
}

export function isCertificationParticipant(participant: { name: string }) {
  return !isCertificationExcludedParticipantName(participant.name);
}
