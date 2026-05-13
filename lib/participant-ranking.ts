export const PARTICIPANT_RANK_SORT_OPTIONS = [
  { key: "certification", label: "인증률" },
  { key: "distance", label: "총거리" },
  { key: "duration", label: "총시간" },
] as const;

export type ParticipantRankSortMode = (typeof PARTICIPANT_RANK_SORT_OPTIONS)[number]["key"];

type SortableParticipantRank = {
  participant: { name: string };
  certifiedDays: number;
  rate: number;
  distanceKm: number;
  durationSeconds: number;
};

function compareByCertification<T extends SortableParticipantRank>(a: T, b: T) {
  return (
    b.rate - a.rate ||
    b.certifiedDays - a.certifiedDays ||
    b.distanceKm - a.distanceKm ||
    b.durationSeconds - a.durationSeconds
  );
}

function compareParticipantRank<T extends SortableParticipantRank>(a: T, b: T, sortMode: ParticipantRankSortMode) {
  const metricCompare = sortMode === "distance"
    ? b.distanceKm - a.distanceKm || compareByCertification(a, b) || b.durationSeconds - a.durationSeconds
    : sortMode === "duration"
      ? b.durationSeconds - a.durationSeconds || compareByCertification(a, b) || b.distanceKm - a.distanceKm
      : compareByCertification(a, b);

  return metricCompare || a.participant.name.localeCompare(b.participant.name, "ko");
}

export function sortParticipantRanks<T extends SortableParticipantRank>(items: readonly T[], sortMode: ParticipantRankSortMode) {
  return [...items].sort((a, b) => compareParticipantRank(a, b, sortMode));
}
