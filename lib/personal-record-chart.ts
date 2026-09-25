import type { PersonalRunRecord } from './personal-records';
import { FOURTH_SEASON_END_DATE as END } from './fourth-season-contract';
const START = '2026-09-01';
export type RecordPeriod = 'day' | 'week' | 'month';
const ms = (date: string) => Date.parse(`${date}T00:00:00Z`);
const addDays = (date: string, days: number) => new Date(ms(date) + days * 86400000).toISOString().slice(0, 10);
const monday = (date: string) => addDays(date, -((new Date(ms(date)).getUTCDay() + 6) % 7));
const positive = (value: number | null) => value !== null && Number.isFinite(value) ? Math.max(0, value) : 0;
export function personalRecordChart(records: PersonalRunRecord[], today: string, period: RecordPeriod, offset = 0) {
  const cutoff = today < START ? START : today > END ? END : today;
  const month = Number(cutoff.slice(5, 7)) - 9;
  const index = Math.max(0, Math.min(month, month + offset));
  const start = period === 'month' ? START : `2026-${String(9 + index).padStart(2, '0')}-01`;
  const periodEnd = period === 'month' ? END : new Date(Date.UTC(2026, 9 + index, 0)).toISOString().slice(0, 10);
  const end = periodEnd < cutoff ? periodEnd : cutoff;
  const buckets: { date: string; label: string; distance: number; minutes: number }[] = [];
  const keyFor = (date: string) => period === 'month' ? date.slice(0, 7) : period === 'week' ? monday(date) : date;
  if (today >= START) {
    if (period === 'month') {
      for (let month = 9; month <= 12; month++) buckets.push({ date: `2026-${String(month).padStart(2,'0')}`, label: `${month}월`, distance: 0, minutes: 0 });
    } else for (let date = start; date <= end; date = addDays(date, 1)) {
      const key = keyFor(date);
      if (buckets.at(-1)?.date !== key) {
        const last = addDays(key, 6) < end ? addDays(key, 6) : end;
        buckets.push({ date: key, label: period === 'week' ? `${Number(date.slice(8))}–${Number(last.slice(8))}일` : `${Number(date.slice(8))}일`, distance: 0, minutes: 0 });
      }
    }
  }
  for (const record of records) {
    if (record.date < start || record.date > end || !(record.status === 'certified' || (record.status === 'needs_review' && record.isPersonal))) continue;
    const bucket = buckets.find(b => b.date === keyFor(record.date));
    if (bucket) { bucket.distance += positive(record.distanceKm); bucket.minutes += positive(record.durationSeconds) / 60; }
  }
  return { start, end, buckets, beforeStart: today < START, canPrevious: period !== 'month' && index > 0, canNext: period !== 'month' && index < month };
}
