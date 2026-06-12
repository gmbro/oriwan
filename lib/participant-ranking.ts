export const PARTICIPANT_RANK_SORT_OPTIONS = [
  { key: "certification", label: "인증률" },
  { key: "distance", label: "총거리" },
  { key: "duration", label: "총시간" },
] as const;

export type ParticipantRankSortMode = (typeof PARTICIPANT_RANK_SORT_OPTIONS)[number]["key"];
export type ParticipantRankSortDirection = "desc" | "asc";

type SortableParticipantRank = {
  participant: { name: string };
  certifiedDays: number;
  rate: number;
  distanceKm: number;
  durationSeconds: number;
};

function compareByName<T extends SortableParticipantRank>(a: T, b: T) {
  return a.participant.name.localeCompare(b.participant.name, "ko-KR", {
    numeric: true,
    sensitivity: "base",
  });
}

function compareParticipantRank<T extends SortableParticipantRank>(
  a: T,
  b: T,
  sortMode: ParticipantRankSortMode,
  sortDirection: ParticipantRankSortDirection
) {
  if (sortMode === "distance") return b.distanceKm - a.distanceKm || compareByName(a, b);
  if (sortMode === "duration") return b.durationSeconds - a.durationSeconds || compareByName(a, b);
  const rateComparison = sortDirection === "asc" ? a.rate - b.rate : b.rate - a.rate;
  return rateComparison || compareByName(a, b);
}

export function sortParticipantRanks<T extends SortableParticipantRank>(
  items: readonly T[],
  sortMode: ParticipantRankSortMode,
  sortDirection: ParticipantRankSortDirection = "desc"
) {
  return [...items].sort((a, b) => compareParticipantRank(a, b, sortMode, sortDirection));
}
