import type { PersonalRunRecord } from "@/lib/personal-records";
export type ActivityMetric = "distance" | "time" | "days";
export type ActivityPeriod = "week" | "month" | "all";
export function activityChart(records: PersonalRunRecord[], today: string, metric: ActivityMetric, period: ActivityPeriod) {
  const to = Math.min(Date.parse(`${today}T00:00:00Z`), Date.parse("2026-12-31T00:00:00Z"));
  const from = period === "week" ? to - 6 * 86400000 : period === "month" ? to - 29 * 86400000 : Date.parse("2026-09-23T00:00:00Z");
  const start = Math.max(from, Date.parse("2026-09-23T00:00:00Z"));
  const byDate = new Map(records.filter(r => r.status === "certified" && r.countsTowardOfficial).map(r => [r.date, r]));
  let cumulative = 0;
  const points: { date: string; value: number }[] = [];
  for (let time = start; time <= to; time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10);
    const record = byDate.get(date);
    cumulative += record ? metric === "distance" ? record.distanceKm ?? 0 : metric === "time" ? (record.durationSeconds ?? 0) / 60 : 1 : 0;
    points.push({ date, value: Math.round(cumulative * 100) / 100 });
  }
  return points;
}
