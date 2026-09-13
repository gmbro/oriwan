export const HELLO_2027_CREW_BANNER_IMAGE = "/images/poc/hello-2027/han-river-crew-ghibli-v2.webp";
export const HEALING_BANNER_IMAGE = "/images/poc/hello-2027/healing/river.webp";
export const HEALING_RUNNER_ATLASES = [
  "/images/poc/hello-2027/healing/runner-a-8.webp",
  "/images/poc/hello-2027/healing/runner-b-8.webp",
] as const;
export type CrewBannerPeriod = "morning" | "day" | "evening" | "night";

export function getCrewBannerPeriod(phase: string): CrewBannerPeriod {
  if (phase === "night") return "night";
  if (phase === "sunset" || phase === "evening") return "evening";
  if (phase === "dawn" || phase === "morning") return "morning";
  return "day";
}

// Five visual progress steps, not individual member avatars.
export function getCrewRunnerCount(completed: number, total: number) {
  const stats = getCrewBannerStats(completed, total);
  return stats.completed === 0 ? 0 : Math.min(5, Math.ceil((stats.completed / stats.total) * 5));
}

export function getCrewBannerStats(completedToday: number, participantCount: number) {
  const total = Number.isFinite(participantCount) ? Math.max(0, Math.floor(participantCount)) : 0;
  const completed = Number.isFinite(completedToday)
    ? Math.min(total, Math.max(0, Math.floor(completedToday)))
    : 0;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    rate,
    description: total > 0 ? `${total}명 중 ${completed}명이 인증했어요` : "크루의 첫 기록을 기다리고 있어요",
    message: completed === 0
      ? "오늘의 첫 걸음을 기다려요."
      : completed === total
        ? "오늘은 모두 함께 해냈어요!"
        : "각자의 속도로, 함께 나아가요.",
  };
}
