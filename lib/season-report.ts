import { buildMemberPictogramMap } from "@/components/member-pictogram";
import { ACTUAL_CERTIFICATION_START_DATE, CHALLENGE_DAYS, CHALLENGE_END_DATE } from "@/lib/challenge";
import {
  getBestWeekdayMorningProgress,
  getCurrentDateStreak,
  getLongestDateStreak,
  getWeekdayMorningProgress,
  growthBadgeAcquisitionPriority,
  makePersonalGrowthBadges,
  type PersonalGrowthBadgeKey,
} from "@/lib/growth-badges";
import type { PublicDashboardPayload, PublicDashboardRecord } from "@/lib/public-dashboard-data";
import { addDays, isCertificationCountedStatus, isRecoveryCertificationRecord, toIsoDate } from "@/lib/run-records";

export type SeasonReportThemeKey = "pacer" | "explorer" | "long-run" | "recovery" | "balance";

export type SeasonReportTheme = {
  key: SeasonReportThemeKey;
  label: string;
  eyebrow: string;
  description: string;
  background: string;
  surface: string;
  accent: string;
  accentSoft: string;
  ink: string;
  decoration: string;
};

export type SeasonReportBadge = {
  key: PersonalGrowthBadgeKey;
  label: string;
  earnedAt: string;
  earnedDate: string;
};

export type SeasonReportWeek = {
  label: string;
  from: string;
  to: string;
  certifiedDays: number;
  targetDays: number;
  rate: number;
};

export type SeasonReportMonth = {
  key: string;
  label: string;
  certifiedDays: number;
  targetDays: number;
  rate: number;
};

export type SeasonReportCalendarCell = {
  date: string;
  day: number;
  status: "certified" | "recovery" | "missed";
  badgeEarned: boolean;
};

export type SeasonReportCalendarMonth = {
  key: string;
  label: string;
  leadingBlankCount: number;
  cells: SeasonReportCalendarCell[];
};

export type SeasonMemberReport = {
  id: string;
  name: string;
  pictogramIndex: number;
  certifiedDays: number;
  certificationRate: number;
  distanceKm: number;
  durationSeconds: number;
  longestStreak: number;
  currentStreak: number;
  recoveryUsageCount: number;
  maxSingleDistanceKm: number;
  maxSingleDurationSeconds: number;
  fiveKmCertificationCount: number;
  tenKmCertificationCount: number;
  halfMarathonCertificationCount: number;
  favoriteWeekday: string;
  bestWeekLabel: string;
  theme: SeasonReportTheme;
  statement: string;
  badges: SeasonReportBadge[];
  recentBadge: SeasonReportBadge | null;
  hasHundredDayBadge: boolean;
  weeks: SeasonReportWeek[];
  months: SeasonReportMonth[];
  calendarMonths: SeasonReportCalendarMonth[];
};

export type SeasonCrewReport = {
  seasonLabel: string;
  from: string;
  to: string;
  participantCount: number;
  totalCertifiedDays: number;
  totalPossibleDays: number;
  certificationRate: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
  recoveryRecordCount: number;
  badgeCount: number;
  bestWeekLabel: string;
  weeks: SeasonReportWeek[];
  months: SeasonReportMonth[];
};

export type SeasonReport = {
  generatedAt: string;
  crew: SeasonCrewReport;
  members: SeasonMemberReport[];
};

type MemberBase = Omit<SeasonMemberReport, "theme" | "statement">;

const WEEKDAY_LABELS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const THEMES: Record<SeasonReportThemeKey, SeasonReportTheme> = {
  pacer: {
    key: "pacer",
    label: "꾸준한 페이서",
    eyebrow: "KEEP THE RHYTHM",
    description: "꾸준함으로 아침의 리듬을 만든 러너",
    background: "#101522",
    surface: "#1d2638",
    accent: "#bef264",
    accentSoft: "#ecfccb",
    ink: "#ffffff",
    decoration: "해돋이",
  },
  explorer: {
    key: "explorer",
    label: "거리 탐험가",
    eyebrow: "GO FARTHER",
    description: "누적 거리를 넓혀 새로운 길을 만든 러너",
    background: "#431407",
    surface: "#7c2d12",
    accent: "#fb923c",
    accentSoft: "#ffedd5",
    ink: "#ffffff",
    decoration: "등고선",
  },
  "long-run": {
    key: "long-run",
    label: "롱런 러너",
    eyebrow: "LONG RUN ENERGY",
    description: "긴 호흡으로 멀리 달리는 힘을 보여준 러너",
    background: "#172554",
    surface: "#1e3a8a",
    accent: "#7dd3fc",
    accentSoft: "#e0f2fe",
    ink: "#ffffff",
    decoration: "산맥",
  },
  recovery: {
    key: "recovery",
    label: "회복 마스터",
    eyebrow: "REST AND RETURN",
    description: "회복을 활용해 자신의 흐름으로 다시 이어온 러너",
    background: "#083344",
    surface: "#155e75",
    accent: "#67e8f9",
    accentSoft: "#cffafe",
    ink: "#ffffff",
    decoration: "물결",
  },
  balance: {
    key: "balance",
    label: "밸런스 러너",
    eyebrow: "OWN YOUR PACE",
    description: "거리와 시간, 인증의 균형을 자기답게 만든 러너",
    background: "#2e1065",
    surface: "#5b21b6",
    accent: "#c4b5fd",
    accentSoft: "#ede9fe",
    ink: "#ffffff",
    decoration: "별자리",
  },
};

export const SEASON_REPORT_FROM = ACTUAL_CERTIFICATION_START_DATE;
export const SEASON_REPORT_TO = CHALLENGE_END_DATE;

function makeChallengeDays() {
  const start = new Date(`${SEASON_REPORT_FROM}T00:00:00`);
  return Array.from({ length: CHALLENGE_DAYS }, (_, index) => toIsoDate(addDays(start, index)));
}

const SEASON_DAYS = makeChallengeDays();

function uniqueCertifiedDates(records: PublicDashboardRecord[]) {
  return Array.from(new Set(records.flatMap((record) => record.record_date ? [record.record_date] : []))).sort();
}

function makeWeeks(certifiedDateSet: Set<string>) {
  return Array.from({ length: Math.ceil(SEASON_DAYS.length / 7) }, (_, index) => {
    const days = SEASON_DAYS.slice(index * 7, index * 7 + 7);
    const certifiedDays = days.filter((day) => certifiedDateSet.has(day)).length;
    return {
      label: `${index + 1}주`,
      from: days[0] || "",
      to: days.at(-1) || "",
      certifiedDays,
      targetDays: days.length,
      rate: days.length ? Math.round((certifiedDays / days.length) * 100) : 0,
    };
  });
}

function makeMonths(certifiedDateSet: Set<string>) {
  const monthKeys = Array.from(new Set(SEASON_DAYS.map((day) => day.slice(0, 7))));
  return monthKeys.map((key) => {
    const days = SEASON_DAYS.filter((day) => day.startsWith(key));
    const certifiedDays = days.filter((day) => certifiedDateSet.has(day)).length;
    return {
      key,
      label: `${Number(key.slice(5, 7))}월`,
      certifiedDays,
      targetDays: days.length,
      rate: days.length ? Math.round((certifiedDays / days.length) * 100) : 0,
    };
  });
}

function makeCalendarMonths(
  recordsByDate: Map<string, PublicDashboardRecord[]>,
  earnedBadgeDates: Set<string>
) {
  return makeMonths(new Set()).map((month): SeasonReportCalendarMonth => {
    const days = SEASON_DAYS.filter((day) => day.startsWith(month.key));
    const firstDay = new Date(`${days[0]}T00:00:00`);
    const leadingBlankCount = (firstDay.getDay() + 6) % 7;
    return {
      key: month.key,
      label: month.label,
      leadingBlankCount,
      cells: days.map((date) => {
        const records = recordsByDate.get(date) || [];
        const hasRegularCertification = records.some((record) => !isRecoveryCertificationRecord(record));
        const hasRecoveryCertification = records.some(isRecoveryCertificationRecord);
        return {
          date,
          day: Number(date.slice(8, 10)),
          status: hasRegularCertification ? "certified" : hasRecoveryCertification ? "recovery" : "missed",
          badgeEarned: earnedBadgeDates.has(date),
        };
      }),
    };
  });
}

function favoriteWeekday(certifiedDates: string[]) {
  const counts = Array.from({ length: 7 }, () => 0);
  certifiedDates.forEach((date) => {
    counts[new Date(`${date}T00:00:00`).getDay()] += 1;
  });
  const bestCount = Math.max(...counts);
  const bestIndex = counts.findIndex((count) => count === bestCount);
  return bestCount ? WEEKDAY_LABELS[bestIndex] : "-";
}

function quantile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(Math.floor((sorted.length - 1) * ratio), sorted.length - 1)] || 0;
}

function chooseTheme(member: MemberBase, members: MemberBase[]): SeasonReportTheme {
  const recoveryThreshold = Math.max(3, quantile(members.map((row) => row.recoveryUsageCount), 0.7));
  const longRunThreshold = Math.max(5, quantile(members.map((row) => row.tenKmCertificationCount), 0.7));
  const distanceThreshold = quantile(members.map((row) => row.distanceKm), 0.7);

  if (member.recoveryUsageCount >= recoveryThreshold && member.certificationRate >= 80) return THEMES.recovery;
  if (member.tenKmCertificationCount >= longRunThreshold || member.halfMarathonCertificationCount >= 2) return THEMES["long-run"];
  if (member.distanceKm >= distanceThreshold) return THEMES.explorer;
  if (member.certificationRate >= 90 || member.longestStreak >= 50) return THEMES.pacer;
  return THEMES.balance;
}

function memberStatement(member: MemberBase, theme: SeasonReportTheme) {
  if (member.certifiedDays >= CHALLENGE_DAYS) return "100일의 아침을 모두 완주했습니다.";
  if (theme.key === "recovery") return `${member.recoveryUsageCount}번 회복하고 다시 자신의 리듬을 이어왔습니다.`;
  if (theme.key === "long-run") return `${member.tenKmCertificationCount}번의 10km 러닝으로 긴 호흡을 만들었습니다.`;
  if (theme.key === "explorer") return `${member.distanceKm.toFixed(1)}km만큼 자신의 지도를 넓혔습니다.`;
  return `100일 동안 ${member.certifiedDays}번의 아침을 열었습니다.`;
}

function makeMemberBase(
  payload: PublicDashboardPayload,
  participant: PublicDashboardPayload["participants"][number],
  pictogramIndex: number
): MemberBase {
  const records = payload.records.filter((record) => (
    record.participant_id === participant.id &&
    isCertificationCountedStatus(record.status) &&
    Boolean(record.record_date && record.record_date >= SEASON_REPORT_FROM && record.record_date <= SEASON_REPORT_TO)
  ));
  const recordsByDate = records.reduce((map, record) => {
    if (!record.record_date) return map;
    const dateRecords = map.get(record.record_date) || [];
    dateRecords.push(record);
    map.set(record.record_date, dateRecords);
    return map;
  }, new Map<string, PublicDashboardRecord[]>());
  const certifiedDates = uniqueCertifiedDates(records);
  const certifiedDateSet = new Set(certifiedDates);
  const recoveryUsageCount = records.filter(isRecoveryCertificationRecord).length;
  const distanceKm = records.reduce((sum, record) => sum + (record.distance_km || 0), 0);
  const durationSeconds = records.reduce((sum, record) => sum + (record.duration_seconds || 0), 0);
  const maxSingleDistanceKm = records.reduce((max, record) => Math.max(max, record.distance_km || 0), 0);
  const maxSingleDurationSeconds = records.reduce((max, record) => Math.max(max, record.duration_seconds || 0), 0);
  const fiveKmCertificationCount = records.filter((record) => (record.distance_km || 0) >= 5).length;
  const tenKmCertificationCount = records.filter((record) => (record.distance_km || 0) >= 10).length;
  const halfMarathonCertificationCount = records.filter((record) => (record.distance_km || 0) >= 21.1).length;
  const longestStreak = getLongestDateStreak(certifiedDates);
  const currentStreak = getCurrentDateStreak(certifiedDates, SEASON_REPORT_TO);
  const persistedBadges = payload.growth_badges.filter((badge) => badge.participant_id === participant.id && badge.earned_at);
  const earnedAtByKey = new Map(persistedBadges.map((badge) => [badge.badge_key, badge.earned_at || ""]));
  const persistedKeys = new Set(persistedBadges.map((badge) => badge.badge_key));
  const calculatedBadges = makePersonalGrowthBadges({
    certifiedDays: certifiedDates.length,
    certifiedDates,
    currentStreak,
    longestStreak,
    weekdayMorningCount: getWeekdayMorningProgress(certifiedDates, SEASON_REPORT_TO),
    bestWeekdayMorningCount: getBestWeekdayMorningProgress(certifiedDates),
    elapsedDayCount: CHALLENGE_DAYS,
    distanceKm,
    durationSeconds,
    maxSingleDistanceKm,
    fiveKmCertificationCount,
    tenKmCertificationCount,
    halfMarathonCertificationCount,
  });
  const badges = calculatedBadges
    .filter((badge) => badge.unlocked || persistedKeys.has(badge.key))
    .map((badge): SeasonReportBadge => {
      const earnedAt = earnedAtByKey.get(badge.key) || "";
      return {
        key: badge.key,
        label: badge.label,
        earnedAt,
        earnedDate: earnedAt ? earnedAt.slice(0, 10) : "",
      };
    })
    .sort((left, right) => {
      const timeDifference = (Date.parse(right.earnedAt) || 0) - (Date.parse(left.earnedAt) || 0);
      if (timeDifference) return timeDifference;
      return growthBadgeAcquisitionPriority(right.key) - growthBadgeAcquisitionPriority(left.key);
    });
  const weeks = makeWeeks(certifiedDateSet);
  const bestWeek = [...weeks].sort((left, right) => right.certifiedDays - left.certifiedDays)[0];
  const earnedBadgeDates = new Set(badges.flatMap((badge) => badge.earnedDate ? [badge.earnedDate] : []));

  return {
    id: participant.id,
    name: participant.name,
    pictogramIndex,
    certifiedDays: certifiedDates.length,
    certificationRate: Math.min(Math.round((certifiedDates.length / CHALLENGE_DAYS) * 100), 100),
    distanceKm,
    durationSeconds,
    longestStreak,
    currentStreak,
    recoveryUsageCount,
    maxSingleDistanceKm,
    maxSingleDurationSeconds,
    fiveKmCertificationCount,
    tenKmCertificationCount,
    halfMarathonCertificationCount,
    favoriteWeekday: favoriteWeekday(certifiedDates),
    bestWeekLabel: bestWeek ? `${bestWeek.label} · ${bestWeek.certifiedDays}/${bestWeek.targetDays}일` : "-",
    badges,
    recentBadge: badges[0] || null,
    hasHundredDayBadge: badges.some((badge) => badge.key === "hundred-day-streak"),
    weeks,
    months: makeMonths(certifiedDateSet),
    calendarMonths: makeCalendarMonths(recordsByDate, earnedBadgeDates),
  };
}

function makeCrewWeeks(payload: PublicDashboardPayload) {
  const participantIdsByDate = new Map<string, Set<string>>();
  payload.records.forEach((record) => {
    if (!record.participant_id || !record.record_date || !isCertificationCountedStatus(record.status)) return;
    if (record.record_date < SEASON_REPORT_FROM || record.record_date > SEASON_REPORT_TO) return;
    const ids = participantIdsByDate.get(record.record_date) || new Set<string>();
    ids.add(record.participant_id);
    participantIdsByDate.set(record.record_date, ids);
  });
  return Array.from({ length: Math.ceil(SEASON_DAYS.length / 7) }, (_, index) => {
    const days = SEASON_DAYS.slice(index * 7, index * 7 + 7);
    const certifiedDays = days.reduce((sum, day) => sum + (participantIdsByDate.get(day)?.size || 0), 0);
    const targetDays = days.length * payload.participants.length;
    return {
      label: `${index + 1}주`,
      from: days[0] || "",
      to: days.at(-1) || "",
      certifiedDays,
      targetDays,
      rate: targetDays ? Math.round((certifiedDays / targetDays) * 100) : 0,
    };
  });
}

export function buildSeasonReport(payload: PublicDashboardPayload): SeasonReport {
  const pictogramMap = buildMemberPictogramMap(payload.participants);
  const bases = payload.participants.map((participant) => (
    makeMemberBase(payload, participant, pictogramMap.get(participant.id) || 0)
  ));
  const members = bases
    .map((member): SeasonMemberReport => {
      const theme = chooseTheme(member, bases);
      return { ...member, theme, statement: memberStatement(member, theme) };
    })
    .sort((left, right) => (
      right.certifiedDays - left.certifiedDays ||
      right.distanceKm - left.distanceKm ||
      left.name.localeCompare(right.name, "ko")
    ));
  const officialRecords = payload.records.filter((record) => (
    isCertificationCountedStatus(record.status) &&
    Boolean(record.record_date && record.record_date >= SEASON_REPORT_FROM && record.record_date <= SEASON_REPORT_TO)
  ));
  const crewWeeks = makeCrewWeeks(payload);
  const bestCrewWeek = [...crewWeeks].sort((left, right) => right.rate - left.rate)[0];
  const monthKeys = Array.from(new Set(SEASON_DAYS.map((day) => day.slice(0, 7))));
  const crewMonths = monthKeys.map((key) => {
    const days = SEASON_DAYS.filter((day) => day.startsWith(key));
    const certifiedDays = members.reduce((sum, member) => {
      const month = member.months.find((item) => item.key === key);
      return sum + (month?.certifiedDays || 0);
    }, 0);
    const targetDays = days.length * payload.participants.length;
    return {
      key,
      label: `${Number(key.slice(5, 7))}월`,
      certifiedDays,
      targetDays,
      rate: targetDays ? Math.round((certifiedDays / targetDays) * 100) : 0,
    };
  });
  const totalCertifiedDays = members.reduce((sum, member) => sum + member.certifiedDays, 0);
  const totalPossibleDays = CHALLENGE_DAYS * members.length;

  return {
    generatedAt: payload.generated_at,
    crew: {
      seasonLabel: "스내사 크루의 100일",
      from: SEASON_REPORT_FROM,
      to: SEASON_REPORT_TO,
      participantCount: members.length,
      totalCertifiedDays,
      totalPossibleDays,
      certificationRate: totalPossibleDays ? Math.round((totalCertifiedDays / totalPossibleDays) * 100) : 0,
      totalDistanceKm: officialRecords.reduce((sum, record) => sum + (record.distance_km || 0), 0),
      totalDurationSeconds: officialRecords.reduce((sum, record) => sum + (record.duration_seconds || 0), 0),
      recoveryRecordCount: officialRecords.filter(isRecoveryCertificationRecord).length,
      badgeCount: members.reduce((sum, member) => sum + member.badges.length, 0),
      bestWeekLabel: bestCrewWeek ? `${bestCrewWeek.label} · ${bestCrewWeek.rate}%` : "-",
      weeks: crewWeeks,
      months: crewMonths,
    },
    members,
  };
}

export function formatSeasonDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}분`;
  if (!minutes) return `${hours.toLocaleString("ko-KR")}시간`;
  return `${hours.toLocaleString("ko-KR")}시간 ${minutes}분`;
}

export function formatSeasonDate(date: string) {
  return date ? date.slice(5).replace("-", ".") : "-";
}
