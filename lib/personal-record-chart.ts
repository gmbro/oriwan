import type { PersonalRunRecord } from './personal-records';

export type RecordPeriod = 'week' | 'month' | 'total';
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export function personalRecordChart(records: PersonalRunRecord[], today: string, period: RecordPeriod) {
  const visible = records.filter(r => r.date <= today && (r.status === 'certified' || r.status === 'needs_review'));
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const start = period === 'week' ? addDays(today, -((weekday + 6) % 7)) : period === 'month' ? `${today.slice(0, 7)}-01` : visible.reduce((first, r) => r.date < first ? r.date : first, today);
  const buckets: { date: string; label: string; distance: number; minutes: number }[] = [];
  for (let date = start; date <= today; date = addDays(date, 1)) {
    const key = period === 'total' ? date.slice(0, 7) : date;
    if (buckets.at(-1)?.date !== key) buckets.push({ date: key, label: period === 'total' ? `${Number(date.slice(5, 7))}월` : `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`, distance: 0, minutes: 0 });
  }
  for (const record of visible) {
    const bucket = buckets.find(b => b.date === (period === 'total' ? record.date.slice(0, 7) : record.date));
    if (bucket) { bucket.distance += record.distanceKm ?? 0; bucket.minutes += (record.durationSeconds ?? 0) / 60; }
  }
  return { start, buckets };
}
