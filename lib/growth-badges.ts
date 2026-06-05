import { ACTUAL_CERTIFICATION_START_DATE } from "@/lib/challenge";
import { addDays, toIsoDate } from "@/lib/run-records";

export type PersonalGrowthBadgeIcon =
  | "run"
  | "flame"
  | "target"
  | "calendar"
  | "sprout"
  | "heart"
  | "mountain"
  | "muscle"
  | "droplet"
  | "sync"
  | "dna";

export type PersonalGrowthBadgeKey =
  | "morning-start"
  | "three-day-rhythm"
  | "seven-day-routine"
  | "weekday-morning"
  | "season-pacer"
  | "thirty-day-root"
  | "fifty-day-core"
  | "seventy-day-arc"
  | "five-k-finisher"
  | "ten-k-finisher"
  | "distance-fifty"
  | "distance-hundred"
  | "time-ten-hours"
  | "time-twenty-hours";

export type PersonalGrowthBadge = {
  key: PersonalGrowthBadgeKey;
  label: string;
  description: string;
  progress: string;
  unlocked: boolean;
  icon: PersonalGrowthBadgeIcon;
  colorClassName: string;
};

export type GrowthBadgeUnlock = {
  participant_id: string | null;
  badge_key: PersonalGrowthBadgeKey | string;
  earned_at?: string | null;
};

export type PersonalGrowthBadgeInput = {
  certifiedDays: number;
  certifiedDates: string[];
  currentStreak: number;
  longestStreak: number;
  weekdayMorningCount: number;
  bestWeekdayMorningCount?: number;
  elapsedDayCount: number;
  distanceKm: number;
  durationSeconds: number;
  maxSingleDistanceKm: number;
};

export function getLongestDateStreak(dates: string[]) {
  const dateSet = new Set(dates);
  return dates.reduce((longest, day) => {
    if (dateSet.has(toIsoDate(addDays(new Date(`${day}T00:00:00`), -1)))) return longest;
    let streak = 0;
    let cursor = day;
    while (dateSet.has(cursor)) {
      streak += 1;
      cursor = toIsoDate(addDays(new Date(`${cursor}T00:00:00`), 1));
    }
    return Math.max(longest, streak);
  }, 0);
}

export function getCurrentDateStreak(dates: string[], referenceDate: string) {
  const dateSet = new Set(dates);
  let streak = 0;
  let cursor = referenceDate;
  while (dateSet.has(cursor)) {
    streak += 1;
    cursor = toIsoDate(addDays(new Date(`${cursor}T00:00:00`), -1));
  }
  return streak;
}

export function getWeekdayMorningProgress(dates: string[], referenceDate: string) {
  const dateSet = new Set(dates);
  const reference = new Date(`${referenceDate}T00:00:00`);
  const day = reference.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDays(reference, mondayOffset);
  const weekdays = Array.from({ length: 5 }, (_, index) => toIsoDate(addDays(monday, index)));
  return weekdays.filter((weekday) => dateSet.has(weekday)).length;
}

export function getBestWeekdayMorningProgress(dates: string[]) {
  const dateSet = new Set(dates);
  const weekStarts = new Set<string>();

  dates.forEach((date) => {
    const current = new Date(`${date}T00:00:00`);
    const day = current.getDay();
    if (day === 0 || day === 6) return;
    weekStarts.add(toIsoDate(addDays(current, 1 - day)));
  });

  return Array.from(weekStarts).reduce((best, weekStart) => {
    const monday = new Date(`${weekStart}T00:00:00`);
    const count = Array.from({ length: 5 }, (_, index) => toIsoDate(addDays(monday, index)))
      .filter((weekday) => dateSet.has(weekday)).length;
    return Math.max(best, count);
  }, 0);
}

function badgeProgress(current: number, target: number, suffix = "") {
  return `${Math.min(Math.floor(current), target)}${suffix}/${target}${suffix}`;
}

export function makePersonalGrowthBadges(input: PersonalGrowthBadgeInput): PersonalGrowthBadge[] {
  const {
    certifiedDays,
    certifiedDates,
    currentStreak,
    longestStreak,
    weekdayMorningCount,
    bestWeekdayMorningCount = weekdayMorningCount,
    elapsedDayCount,
    distanceKm,
    durationSeconds,
    maxSingleDistanceKm,
  } = input;
  const durationHours = durationSeconds / 3600;
  const bestWeekdayCount = Math.max(weekdayMorningCount, bestWeekdayMorningCount);

  return [
    {
      key: "morning-start",
      label: "모닝 스타터",
      description: "오전 러닝 첫 인증",
      progress: `${Math.min(certifiedDays, 1)}/1`,
      unlocked: certifiedDays >= 1,
      icon: "run",
      colorClassName: "bg-lime-300 text-slate-950",
    },
    {
      key: "three-day-rhythm",
      label: "3일 리듬",
      description: "3일 연속 인증",
      progress: badgeProgress(longestStreak, 3),
      unlocked: longestStreak >= 3,
      icon: "flame",
      colorClassName: "bg-amber-50 text-slate-950",
    },
    {
      key: "seven-day-routine",
      label: "7일 루틴",
      description: "7일 연속 인증",
      progress: `${Math.min(longestStreak, 7)}/7`,
      unlocked: longestStreak >= 7,
      icon: "target",
      colorClassName: "bg-[#101522] text-white",
    },
    {
      key: "weekday-morning",
      label: "평일 모닝 5",
      description: "평일 5일 인증",
      progress: `${Math.min(bestWeekdayCount, 5)}/5`,
      unlocked: bestWeekdayCount >= 5,
      icon: "calendar",
      colorClassName: "bg-lime-300 text-slate-950",
    },
    {
      key: "season-pacer",
      label: "시즌 페이서",
      description: "오늘까지 빠짐없이 인증",
      progress: `${certifiedDates.length}/${Math.max(elapsedDayCount, 1)}`,
      unlocked: elapsedDayCount > 0 && certifiedDays >= elapsedDayCount,
      icon: "heart",
      colorClassName: "bg-rose-400 text-white",
    },
    {
      key: "thirty-day-root",
      label: "30일 뿌리",
      description: "30일 연속 인증",
      progress: badgeProgress(longestStreak, 30),
      unlocked: longestStreak >= 30,
      icon: "dna",
      colorClassName: "bg-[#101522] text-white",
    },
    {
      key: "fifty-day-core",
      label: "50일 코어",
      description: "50일 연속 인증",
      progress: badgeProgress(longestStreak, 50),
      unlocked: longestStreak >= 50,
      icon: "muscle",
      colorClassName: "bg-amber-50 text-slate-950",
    },
    {
      key: "seventy-day-arc",
      label: "70일 아치",
      description: "70일 연속 인증",
      progress: badgeProgress(longestStreak, 70),
      unlocked: longestStreak >= 70,
      icon: "mountain",
      colorClassName: "bg-slate-950 text-lime-200",
    },
    {
      key: "five-k-finisher",
      label: "5K 완주",
      description: "하루 5km 이상 러닝",
      progress: badgeProgress(maxSingleDistanceKm, 5, "km"),
      unlocked: maxSingleDistanceKm >= 5,
      icon: "sprout",
      colorClassName: "bg-[#101522] text-white",
    },
    {
      key: "ten-k-finisher",
      label: "10K 완주",
      description: "하루 10km 이상 러닝",
      progress: badgeProgress(maxSingleDistanceKm, 10, "km"),
      unlocked: maxSingleDistanceKm >= 10,
      icon: "mountain",
      colorClassName: "bg-lime-300 text-slate-950",
    },
    {
      key: "distance-fifty",
      label: "거리 50K",
      description: "누적 50km 달성",
      progress: badgeProgress(distanceKm, 50, "km"),
      unlocked: distanceKm >= 50,
      icon: "run",
      colorClassName: "bg-amber-50 text-slate-950",
    },
    {
      key: "distance-hundred",
      label: "거리 100K",
      description: "누적 100km 달성",
      progress: badgeProgress(distanceKm, 100, "km"),
      unlocked: distanceKm >= 100,
      icon: "target",
      colorClassName: "bg-rose-400 text-white",
    },
    {
      key: "time-ten-hours",
      label: "시간 10H",
      description: "누적 러닝 10시간",
      progress: badgeProgress(durationHours, 10, "h"),
      unlocked: durationHours >= 10,
      icon: "droplet",
      colorClassName: "bg-slate-950 text-lime-200",
    },
    {
      key: "time-twenty-hours",
      label: "시간 20H",
      description: "누적 러닝 20시간",
      progress: badgeProgress(durationHours, 20, "h"),
      unlocked: durationHours >= 20,
      icon: "sync",
      colorClassName: "bg-lime-300 text-slate-950",
    },
  ];
}

export function isKnownGrowthBadgeKey(value: string): value is PersonalGrowthBadgeKey {
  return makePersonalGrowthBadges({
    certifiedDays: 0,
    certifiedDates: [],
    currentStreak: 0,
    longestStreak: 0,
    weekdayMorningCount: 0,
    elapsedDayCount: 0,
    distanceKm: 0,
    durationSeconds: 0,
    maxSingleDistanceKm: 0,
  }).some((badge) => badge.key === value);
}

export const GROWTH_BADGE_UNLOCK_START_DATE = ACTUAL_CERTIFICATION_START_DATE;
