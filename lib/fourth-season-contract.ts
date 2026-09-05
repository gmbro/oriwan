export const FOURTH_SEASON_KEY = "4th";
export const FOURTH_SEASON_START_DATE = "2026-09-23";
export const FOURTH_SEASON_DAYS = 100;
export const FOURTH_SEASON_END_DATE = "2026-12-31";

// 3기 종료 다음 날부터 4기 준비 러닝을 개인 기록으로 남길 수 있습니다.
// 공식 인증률과 D-day 계산은 FOURTH_SEASON_START_DATE 이후 기록만 사용합니다.
export const FOURTH_PERSONAL_RECORD_START_DATE = "2026-08-13";

export const FOURTH_SEASON_DATE_ERROR = `4기 러닝 기록은 ${FOURTH_SEASON_START_DATE}부터 ${FOURTH_SEASON_END_DATE}까지만 남길 수 있어요.`;
export const FOURTH_PERSONAL_RECORD_DATE_ERROR = `4기 개인 러닝 기록은 ${FOURTH_PERSONAL_RECORD_START_DATE}부터 ${FOURTH_SEASON_END_DATE}까지만 남길 수 있어요. ${FOURTH_SEASON_START_DATE} 전 기록은 개인 기록에만 표시되고 공식 인증에는 포함되지 않아요.`;

function isIsoCalendarDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

export function isWithinFourthSeasonWindow(value: string | null | undefined) {
  return Boolean(
    isIsoCalendarDate(value)
    && value >= FOURTH_SEASON_START_DATE
    && value <= FOURTH_SEASON_END_DATE
  );
}

export function clampToFourthSeasonWindow(value: string) {
  if (value < FOURTH_SEASON_START_DATE) return FOURTH_SEASON_START_DATE;
  if (value > FOURTH_SEASON_END_DATE) return FOURTH_SEASON_END_DATE;
  return value;
}

export function isWithinFourthPersonalRecordWindow(value: string | null | undefined) {
  return Boolean(
    isIsoCalendarDate(value)
    && value >= FOURTH_PERSONAL_RECORD_START_DATE
    && value <= FOURTH_SEASON_END_DATE
  );
}

export function clampToFourthPersonalRecordWindow(value: string) {
  if (value < FOURTH_PERSONAL_RECORD_START_DATE) return FOURTH_PERSONAL_RECORD_START_DATE;
  if (value > FOURTH_SEASON_END_DATE) return FOURTH_SEASON_END_DATE;
  return value;
}

export function isFourthOfficialCertificationDate(value: string | null | undefined) {
  return isWithinFourthSeasonWindow(value);
}
