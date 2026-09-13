import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSeasonEvent, type SeasonEvent } from "./season-schedule-contract";
export const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Local edits use a separate namespace so preview schedules never appear in production.
export function scheduleDirectory(owner: string) { return `hello-2027/schedules/${process.env.NODE_ENV === "development" ? "local" : "live"}/${owner}`; }
export async function readSeasonEvents(service: SupabaseClient, owner: string): Promise<SeasonEvent[]> {
  const bucket = service.storage.from("photos");
  const directory = scheduleDirectory(owner);
  const { data, error } = await bucket.list(directory, { limit: 1000 });
  if (error) throw error;
  const files = (data || []).filter(f => EVENT_ID.test(f.name.replace(/\.txt$/, "")) && f.name.endsWith(".txt"));
  const events = await Promise.all(files.map(async f => {
    const result = await bucket.download(`${directory}/${f.name}`);
    if (result.error) throw result.error;
    const parsed = parseSeasonEvent(JSON.parse(await result.data.text()));
    if (!parsed) throw new Error("Invalid schedule data");
    return { id: f.name.slice(0,-4), ...parsed };
  }));
  return events.sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}
