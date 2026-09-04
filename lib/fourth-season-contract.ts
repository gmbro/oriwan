export const FOURTH_SEASON_KEY = "4th";
export const FOURTH_SEASON_START_DATE = "2026-09-23";
export const FOURTH_SEASON_DAYS = 100;
export const FOURTH_SEASON_END_DATE = "2026-12-31";

export const FOURTH_SEASON_DATE_ERROR = `4기 러닝 기록은 ${FOURTH_SEASON_START_DATE}부터 ${FOURTH_SEASON_END_DATE}까지만 남길 수 있어요.`;

export function isWithinFourthSeasonWindow(value: string | null | undefined) {
  return Boolean(
    value
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && value >= FOURTH_SEASON_START_DATE
    && value <= FOURTH_SEASON_END_DATE
  );
}

export function clampToFourthSeasonWindow(value: string) {
  if (value < FOURTH_SEASON_START_DATE) return FOURTH_SEASON_START_DATE;
  if (value > FOURTH_SEASON_END_DATE) return FOURTH_SEASON_END_DATE;
  return value;
}
