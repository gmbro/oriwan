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

export const PERSONAL_GROWTH_BADGE_KEYS = [
  "morning-start",
  "three-day-rhythm",
  "seven-day-routine",
  "weekday-morning",
  "season-pacer",
  "thirty-day-root",
  "fifty-day-core",
  "seventy-day-arc",
  "hundred-day-streak",
  "five-k-finisher",
  "ten-k-finisher",
  "steady-five-k",
  "long-run-maker",
  "half-trigger",
  "distance-fifty",
  "distance-hundred",
  "distance-three-hundred",
  "distance-four-hundred",
  "distance-five-hundred",
  "time-ten-hours",
  "time-twenty-hours",
] as const;

export type PersonalGrowthBadgeKey = (typeof PERSONAL_GROWTH_BADGE_KEYS)[number];

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
  fiveKmCertificationCount: number;
  tenKmCertificationCount: number;
  halfMarathonCertificationCount: number;
};

export type GrowthBadgeAchievementRecord = {
  recordDate: string;
  distanceKm: number;
  durationSeconds: number;
};

export type PersonalGrowthBadgeEarnedDates = Record<PersonalGrowthBadgeKey, string | null>;

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

function getStreakAchievementDate(dates: string[], target: number) {
  const sortedDates = Array.from(new Set(dates)).sort();
  let streak = 0;
  let previousDate = "";

  for (const date of sortedDates) {
    const isConsecutive = previousDate
      ? toIsoDate(addDays(new Date(`${previousDate}T00:00:00`), 1)) === date
      : false;
    streak = isConsecutive ? streak + 1 : 1;
    if (streak >= target) return date;
    previousDate = date;
  }

  return null;
}

function getWeekdayMorningAchievementDate(dates: string[]) {
  const weekdayDatesByWeek = new Map<string, Set<string>>();

  for (const date of Array.from(new Set(dates)).sort()) {
    const current = new Date(`${date}T00:00:00`);
    const day = current.getDay();
    if (day === 0 || day === 6) continue;

    const monday = toIsoDate(addDays(current, 1 - day));
    const weekdayDates = weekdayDatesByWeek.get(monday) || new Set<string>();
    weekdayDates.add(date);
    weekdayDatesByWeek.set(monday, weekdayDates);
    if (weekdayDates.size >= 5) return date;
  }

  return null;
}

function getNthMatchingRecordDate(
  records: GrowthBadgeAchievementRecord[],
  target: number,
  matches: (record: GrowthBadgeAchievementRecord) => boolean
) {
  let count = 0;

  for (const record of records) {
    if (!matches(record)) continue;
    count += 1;
    if (count >= target) return record.recordDate;
  }

  return null;
}

function getCumulativeAchievementDate(
  records: GrowthBadgeAchievementRecord[],
  target: number,
  valueOf: (record: GrowthBadgeAchievementRecord) => number
) {
  let total = 0;

  for (const record of records) {
    total += Math.max(valueOf(record), 0);
    if (total >= target) return record.recordDate;
  }

  return null;
}

export function getPersonalGrowthBadgeEarnedDates(
  records: GrowthBadgeAchievementRecord[]
): PersonalGrowthBadgeEarnedDates {
  const sortedRecords = [...records].sort((left, right) => left.recordDate.localeCompare(right.recordDate));
  const certifiedDates = Array.from(new Set(sortedRecords.map((record) => record.recordDate))).sort();
  const firstCertifiedDate = certifiedDates[0] || null;

  return {
    "morning-start": firstCertifiedDate,
    "three-day-rhythm": getStreakAchievementDate(certifiedDates, 3),
    "seven-day-routine": getStreakAchievementDate(certifiedDates, 7),
    "weekday-morning": getWeekdayMorningAchievementDate(certifiedDates),
    "season-pacer": firstCertifiedDate === ACTUAL_CERTIFICATION_START_DATE ? firstCertifiedDate : null,
    "thirty-day-root": getStreakAchievementDate(certifiedDates, 30),
    "fifty-day-core": getStreakAchievementDate(certifiedDates, 50),
    "seventy-day-arc": getStreakAchievementDate(certifiedDates, 70),
    "hundred-day-streak": getStreakAchievementDate(certifiedDates, 100),
    "five-k-finisher": getNthMatchingRecordDate(sortedRecords, 1, (record) => record.distanceKm >= 5),
    "ten-k-finisher": getNthMatchingRecordDate(sortedRecords, 1, (record) => record.distanceKm >= 10),
    "steady-five-k": getNthMatchingRecordDate(sortedRecords, 15, (record) => record.distanceKm >= 5),
    "long-run-maker": getNthMatchingRecordDate(sortedRecords, 20, (record) => record.distanceKm >= 10),
    "half-trigger": getNthMatchingRecordDate(sortedRecords, 3, (record) => record.distanceKm >= 21.1),
    "distance-fifty": getCumulativeAchievementDate(sortedRecords, 50, (record) => record.distanceKm),
    "distance-hundred": getCumulativeAchievementDate(sortedRecords, 100, (record) => record.distanceKm),
    "distance-three-hundred": getCumulativeAchievementDate(sortedRecords, 300, (record) => record.distanceKm),
    "distance-four-hundred": getCumulativeAchievementDate(sortedRecords, 400, (record) => record.distanceKm),
    "distance-five-hundred": getCumulativeAchievementDate(sortedRecords, 500, (record) => record.distanceKm),
    "time-ten-hours": getCumulativeAchievementDate(sortedRecords, 10 * 3600, (record) => record.durationSeconds),
    "time-twenty-hours": getCumulativeAchievementDate(sortedRecords, 20 * 3600, (record) => record.durationSeconds),
  };
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
    fiveKmCertificationCount,
    tenKmCertificationCount,
    halfMarathonCertificationCount,
  } = input;
  const durationHours = durationSeconds / 3600;
  const bestWeekdayCount = Math.max(weekdayMorningCount, bestWeekdayMorningCount);
  const shouldShowHundredDayStreak = longestStreak >= 70 && elapsedDayCount >= 80;
  const hundredDayStreakBadge: PersonalGrowthBadge | null = shouldShowHundredDayStreak ? {
    key: "hundred-day-streak",
    label: elapsedDayCount >= 90 ? "100일 연속인증" : "???",
    description: elapsedDayCount >= 90 ? "100일 연속 인증" : "90일차에 이름이 공개되는 히든 뱃지",
    progress: badgeProgress(longestStreak, 100),
    unlocked: longestStreak >= 100,
    icon: "mountain",
    colorClassName: "bg-slate-950 text-lime-200",
  } : null;

  const badges: PersonalGrowthBadge[] = [
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
      label: "30일 연속 인증",
      description: "30일 연속 인증",
      progress: badgeProgress(longestStreak, 30),
      unlocked: longestStreak >= 30,
      icon: "dna",
      colorClassName: "bg-[#101522] text-white",
    },
    {
      key: "fifty-day-core",
      label: "50일 연속 인증",
      description: "50일 연속 인증",
      progress: badgeProgress(longestStreak, 50),
      unlocked: longestStreak >= 50,
      icon: "muscle",
      colorClassName: "bg-amber-50 text-slate-950",
    },
    {
      key: "seventy-day-arc",
      label: "70일 연속 인증",
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
      key: "steady-five-k",
      label: "스테디 5K",
      description: "5km 이상 인증 15회",
      progress: badgeProgress(fiveKmCertificationCount, 15, "회"),
      unlocked: fiveKmCertificationCount >= 15,
      icon: "target",
      colorClassName: "bg-lime-300 text-slate-950",
    },
    {
      key: "long-run-maker",
      label: "롱런 메이커",
      description: "10km 이상 인증 20회",
      progress: badgeProgress(tenKmCertificationCount, 20, "회"),
      unlocked: tenKmCertificationCount >= 20,
      icon: "mountain",
      colorClassName: "bg-slate-950 text-lime-200",
    },
    {
      key: "half-trigger",
      label: "하프 트리거",
      description: "하루 21.1km 이상 3회",
      progress: badgeProgress(halfMarathonCertificationCount, 3, "회"),
      unlocked: halfMarathonCertificationCount >= 3,
      icon: "flame",
      colorClassName: "bg-rose-400 text-white",
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
      key: "distance-three-hundred",
      label: "300K 항해자",
      description: "누적 300km 달성",
      progress: badgeProgress(distanceKm, 300, "km"),
      unlocked: distanceKm >= 300,
      icon: "mountain",
      colorClassName: "bg-lime-300 text-slate-950",
    },
    {
      key: "distance-four-hundred",
      label: "400K 정복자",
      description: "누적 400km 달성",
      progress: badgeProgress(distanceKm, 400, "km"),
      unlocked: distanceKm >= 400,
      icon: "target",
      colorClassName: "bg-slate-950 text-lime-200",
    },
    {
      key: "distance-five-hundred",
      label: "500K 미친자",
      description: "누적 500km 달성",
      progress: badgeProgress(distanceKm, 500, "km"),
      unlocked: distanceKm >= 500,
      icon: "flame",
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

  if (hundredDayStreakBadge) {
    const seventyDayIndex = badges.findIndex((badge) => badge.key === "seventy-day-arc");
    badges.splice(seventyDayIndex + 1, 0, hundredDayStreakBadge);
  }

  return badges;
}

export function isKnownGrowthBadgeKey(value: string): value is PersonalGrowthBadgeKey {
  return (PERSONAL_GROWTH_BADGE_KEYS as readonly string[]).includes(value);
}

export const GROWTH_BADGE_UNLOCK_START_DATE = ACTUAL_CERTIFICATION_START_DATE;
