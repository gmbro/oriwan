import type { PersonalRunRecord } from './personal-records';
import { FOURTH_SEASON_END_DATE as END } from './fourth-season-contract';
const START = '2026-09-01';
export type RecordPeriod = 'week' | 'month' | 'total';
const ms = (date: string) => Date.parse(`${date}T00:00:00Z`);
const addDays = (date: string, days: number) => new Date(ms(date) + days * 86400000).toISOString().slice(0, 10);
export function personalRecordChart(records: PersonalRunRecord[], today: string, period: RecordPeriod, offset = 0) {
  const cutoff = today < START ? START : today > END ? END : today;
  const week = Math.floor((ms(cutoff) - ms(START)) / 604800000);
  const month = Number(cutoff.slice(5, 7)) - 9;
  const index = Math.max(0, Math.min(period === 'week' ? week : month, (period === 'week' ? week : month) + offset));
  const start = period === 'week' ? addDays(START, index * 7) : period === 'month' ? index === 0 ? START : `2026-${String(9 + index).padStart(2,'0')}-01` : START;
  const periodEnd = period === 'week' ? addDays(start, 6) : period === 'month' ? new Date(Date.UTC(2026, 9 + index, 0)).toISOString().slice(0,10) : END;
  const end = periodEnd < cutoff ? periodEnd : cutoff;
  const buckets: { date: string; label: string; distance: number; minutes: number }[] = [];
  if (today >= START) for (let date = start; date <= end; date = addDays(date, 1)) {
    const key = period === 'total' ? date.slice(0, 7) : date;
    if (buckets.at(-1)?.date !== key) buckets.push({ date: key, label: period === 'total' ? `${Number(date.slice(5, 7))}월` : `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`, distance: 0, minutes: 0 });
  }
  for (const record of records) {
    if (record.date < start || record.date > end || record.date > today || !(record.status === 'certified' || (record.status === 'needs_review' && record.isPersonal))) continue;
    const bucket = buckets.find(b => b.date === (period === 'total' ? record.date.slice(0, 7) : record.date));
    if (bucket) { bucket.distance += record.distanceKm ?? 0; bucket.minutes += (record.durationSeconds ?? 0) / 60; }
  }
  return { start, end, buckets, beforeStart: today < START, canPrevious: period !== 'total' && index > 0, canNext: period !== 'total' && index < (period === 'week' ? week : month) };
}
