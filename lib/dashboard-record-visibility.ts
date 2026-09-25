import type { Hello2027Snapshot } from "./hello-2027-types";

// Public calendars contain approved dates and numeric metrics only.
// Never spread source rows: images, notes and pending records remain private.
export function projectDashboardRecords(snapshot: Hello2027Snapshot, authenticated: boolean): Hello2027Snapshot {
  if (authenticated) return { ...snapshot, guestbook: [] };
  const today = snapshot.referenceDateIso || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const monday = new Date(`${today}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const weekStart = monday.toISOString().slice(0, 10);
  return { ...snapshot, guestbook: [], participants: snapshot.participants.map(p => {
    const approved = p.recordHistory.filter(r => (r.status === "certified" || r.isPersonal) && r.recordDateIso <= today);
    const weekly = approved.filter(r => r.recordDateIso >= weekStart);
    const sum = (rows: typeof approved, key: "distanceKm" | "durationMinutes") =>
      rows.reduce((total, r) => total + (Number.isFinite(r[key]) ? Math.max(0, r[key] ?? 0) : 0), 0);
    return {
      id: p.id, fullName: p.fullName, pictogramIndex: p.pictogramIndex,
      profileImageUrl: p.profileImageUrl, timeMachineActive: p.timeMachineActive,
      completed: p.completed, seasonCompletionRate: p.seasonCompletionRate,
      distanceKm: null, durationMinutes: null,
      certifiedDays: p.certifiedDays, recordHistory: approved.map(r => ({recordDateIso:r.recordDateIso,monthDay:r.monthDay,weekday:r.weekday,distanceKm:r.distanceKm,durationMinutes:r.durationMinutes,status:r.status,isPersonal:r.isPersonal})),
      totalDistanceKm: sum(approved, "distanceKm"), totalDurationMinutes: Math.round(sum(approved, "durationMinutes")),
      weeklyDistanceKm: sum(weekly, "distanceKm"), weeklyDurationMinutes: Math.round(sum(weekly, "durationMinutes")),
      product: { name: "자기소개", description: "" },
    };
  }) };
}
