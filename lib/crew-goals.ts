const CREW_GOAL_KM = [1000, 2027, 5000, 10000] as const;

/** Recompute from approved distance so corrections never leave a false checkmark. */
export function getCrewGoals(distanceKm: number) {
  const distance = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
  return CREW_GOAL_KM.map((targetKm, index) => ({
    step: index + 1,
    targetKm,
    state: distance >= targetKm ? "completed" as const
      : index === 0 || distance >= CREW_GOAL_KM[index - 1] ? "active" as const : "locked" as const,
  }));
}
