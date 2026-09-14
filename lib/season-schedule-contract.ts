export type SeasonEvent = { id: string; date: string; endDate?: string; time: string; endTime?: string; title: string; location: string; description: string };
export const SCHEDULE_START = "2026-09-01";
export const SCHEDULE_END = "2027-01-01";
export function parseSeasonEvent(value: unknown): Omit<SeasonEvent, "id"> | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof row[key] === "string" && (row[key] as string).trim().length <= max ? (row[key] as string).trim() : null;
  const date = text("date", 10), time = text("time", 5), title = text("title", 80), location = text("location", 120), description = text("description", 4000);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < SCHEDULE_START || date > SCHEDULE_END || (!Number.isFinite(Date.parse(date + "T00:00:00Z")) || new Date(date + "T00:00:00Z").toISOString().slice(0,10) !== date)) return null;
  if (time === null || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) || !title || location === null || description === null) return null;
  const endTime = row.endTime === undefined ? "" : text("endTime", 5);
  if (endTime === null || (endTime && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || !time || endTime <= time))) return null;
  const endDate = row.endDate === undefined ? "" : text("endDate", 10);
  if (endDate === null || (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < date || endDate > SCHEDULE_END || !Number.isFinite(Date.parse(endDate)) || new Date(endDate).toISOString().slice(0,10) !== endDate))) return null;
  return { date, ...(endDate ? {endDate} : {}), time, title, location, description, ...(endTime ? {endTime} : {}) };
}
