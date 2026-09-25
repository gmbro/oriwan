export const FOURTH_SEASON_KEY = "4th";
export const FOURTH_SEASON_START_DATE = "2026-09-23";
export const FOURTH_SEASON_DAYS = 100;
export const FOURTH_SEASON_END_DATE = "2026-12-31";

// 3기 종료 다음 날부터 4기 준비 러닝을 개인 기록으로 남길 수 있습니다.
// 공식 인증률은 시작일부터, 헤더 D-day는 시즌 마지막 날을 기준으로 계산합니다.
export const FOURTH_PERSONAL_RECORD_START_DATE = "2026-08-13";

export const FOURTH_SEASON_DATE_ERROR = `4기 러닝 기록은 ${FOURTH_SEASON_START_DATE}부터 ${FOURTH_SEASON_END_DATE}까지만 남길 수 있어요.`;
export const FOURTH_PERSONAL_RECORD_DATE_ERROR = `4기 개인 러닝 기록은 ${FOURTH_PERSONAL_RECORD_START_DATE}부터 ${FOURTH_SEASON_END_DATE}까지만 남길 수 있어요. ${FOURTH_SEASON_START_DATE} 전 기록은 개인 기록에만 표시되고 공식 인증에는 포함되지 않아요.`;

const MILLISECONDS_PER_DAY = 86_400_000;

function isIsoCalendarDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

function isoCalendarDateToUtcDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY;
}

export function formatFourthSeasonDday(kstDateIso: string | null | undefined) {
  if (!isIsoCalendarDate(kstDateIso)) return null;

  const daysUntilEnd = isoCalendarDateToUtcDay(FOURTH_SEASON_END_DATE)
    - isoCalendarDateToUtcDay(kstDateIso);
  if (daysUntilEnd > 0) return `D-${daysUntilEnd}`;
  if (daysUntilEnd === 0) return "D-DAY";
  return `D+${Math.abs(daysUntilEnd)}`;
}

export function fourthOfficialMemberTotals(records: readonly {recordDateIso:string;status:string;distanceKm:number|null;durationMinutes:number|null}[], today: string) {
  const official = records.filter(record => record.status === "certified" && isWithinFourthSeasonWindow(record.recordDateIso) && record.recordDateIso <= today);
  return {
    totalDistanceKm: official.reduce((sum, record) => sum + Math.max(0, record.distanceKm ?? 0), 0),
    totalDurationMinutes: official.reduce((sum, record) => sum + Math.max(0, record.durationMinutes ?? 0), 0),
  };
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

// Display totals include confirmed personal runs from September, not pending OCR.
export function fourthMemberTotals(records: readonly {recordDateIso:string;status:string;distanceKm:number|null;durationMinutes:number|null;isPersonal?:boolean}[], today:string) {
 const visible=records.filter(r=>r.recordDateIso >= "2026-09-01" && r.recordDateIso <= today && r.recordDateIso <= FOURTH_SEASON_END_DATE && (r.status === "certified" || (r.status === "needs_review" && r.isPersonal)));
 const official=visible.filter(r=>r.status === "certified" && isWithinFourthSeasonWindow(r.recordDateIso));
 const sum=(rows:typeof visible,key:"distanceKm"|"durationMinutes")=>rows.reduce((n,r)=>n+(Number.isFinite(r[key])?Math.max(0,r[key]??0):0),0);
 const certifiedDistanceKm=sum(official,"distanceKm");
 const totalDistanceKm=sum(visible,"distanceKm");
 return {totalDistanceKm,totalDurationMinutes:sum(visible,"durationMinutes"),certifiedDistanceKm,personalDistanceKm:Math.max(0,totalDistanceKm-certifiedDistanceKm)};
}
