/** Same local time next calendar month in Korea, clamped for month ends. */
export function nextSupportDate(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const day = kst.getUTCDate();
  kst.setUTCDate(1);
  kst.setUTCMonth(kst.getUTCMonth() + 1);
  const last = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 0)).getUTCDate();
  kst.setUTCDate(Math.min(day, last));
  return new Date(kst.getTime() - 9 * 3600_000).toISOString();
}
