import type { Hello2027Snapshot } from "./hello-2027-types";

// Apply after reading the shared cache, never store a viewer-specific projection in it.
export function projectDashboardRecords(snapshot: Hello2027Snapshot, authenticated: boolean): Hello2027Snapshot {
  if (authenticated) return { ...snapshot, guestbook: [] };
  return { ...snapshot, guestbook: [], participants: snapshot.participants.map(p => ({
    id: p.id, fullName: p.fullName, pictogramIndex: p.pictogramIndex,
    profileImageUrl: p.profileImageUrl, timeMachineActive: p.timeMachineActive,
    completed: false, seasonCompletionRate: 0, distanceKm: null, durationMinutes: null,
    certifiedDays: 0, recordHistory: [], totalDistanceKm: 0, totalDurationMinutes: 0,
    product: { name: p.product.name, description: p.product.description },
  })) };
}
