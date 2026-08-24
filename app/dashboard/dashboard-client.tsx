"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconArrowRight, IconCalendar, IconDna, IconDroplet, IconFlame, IconHeart, IconMountain, IconMuscle, IconRun, IconSprout, IconSync, IconTarget, IconVideo, IconX } from "@/components/icons";
import { buildMemberPictogramMap, MemberPictogram } from "@/components/member-pictogram";
import { NextSeasonNoticeModal } from "@/components/next-season-notice-modal";
import { ACTUAL_CERTIFICATION_START_DATE, CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_DAYS, CHALLENGE_END_DATE, NEXT_SEASON_START_DATE } from "@/lib/challenge";
import { DASHBOARD_REFRESH_CHANNEL, DASHBOARD_REFRESH_EVENT } from "@/lib/dashboard-refresh";
import {
  growthBadgeAcquisitionPriority,
  getBestWeekdayMorningProgress,
  getCurrentDateStreak,
  getLongestDateStreak,
  getWeekdayMorningProgress,
  makePersonalGrowthBadges,
  type PersonalGrowthBadge,
} from "@/lib/growth-badges";
import { type ParticipantRankSortDirection, type ParticipantRankSortMode, sortParticipantRanks } from "@/lib/participant-ranking";
import type { PublicDashboardParticipant as Participant, PublicDashboardPayload as PublicDashboardData, PublicDashboardRecord as RunRecord } from "@/lib/public-dashboard-data";
import { addDays, formatKstTime, isCertificationCountedStatus, isRecoveryCertificationRecord, secondsToTime, toIsoDate, toKstIsoDate } from "@/lib/run-records";
import { createClient } from "@/lib/supabase/client";

type TrendModal = "weekly" | "daily" | null;

type ParticipantGrowthMetrics = {
  distanceKm: number;
  durationSeconds: number;
  maxSingleDistanceKm: number;
  fiveKmCertificationCount: number;
  tenKmCertificationCount: number;
  halfMarathonCertificationCount: number;
};

const LazyYoutubeShortsSection = dynamic(
  () => import("@/components/youtube-shorts-section").then((mod) => mod.YoutubeShortsSection),
  { ssr: false }
);

const LazyRecoveryDashboardDetails = dynamic(
  () => import("@/components/recovery-trend-line-chart").then((mod) => mod.RecoveryDashboardDetails),
  { loading: () => <div className="h-28 animate-pulse rounded-2xl bg-white/70" aria-label="리커버리 추이 불러오는 중" /> }
);

const actualCertificationEndDate = toIsoDate(addDays(new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`), CHALLENGE_DAYS - 1));

function formatLastUpdated(value?: string) {
  if (!value) return "-";
  return formatKstTime(value);
}

function certificationDayLabel(referenceDate: string) {
  const start = new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`);
  const current = new Date(`${referenceDate}T00:00:00`);
  const diffDays = Math.floor((current.getTime() - start.getTime()) / 86_400_000);
  if (diffDays < 0) return `D-${CHALLENGE_DAYS}`;
  if (referenceDate >= actualCertificationEndDate) return "완료";
  return `D-${Math.max(CHALLENGE_DAYS - diffDays, 0)}`;
}

function certificationDayNumber(referenceDate: string) {
  const start = new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`);
  const current = new Date(`${referenceDate}T00:00:00`);
  return Math.floor((current.getTime() - start.getTime()) / 86_400_000) + 1;
}

function shortDate(value: string) {
  return value.slice(5).replace("-", ".");
}

function formatCompactNumber(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits,
  });
}

function formatTeamDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}분`;
  if (!minutes) return `${formatCompactNumber(hours)}시간`;
  return `${formatCompactNumber(hours)}시간 ${minutes}분`;
}

function makeDaysFrom(startDate: string, days = CHALLENGE_DAYS) {
  const start = new Date(`${startDate}T00:00:00`);
  return Array.from({ length: days }, (_, index) => toIsoDate(addDays(start, index)));
}

function makeDaysThrough(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate < startDate ? startDate : endDate}T00:00:00`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return makeDaysFrom(startDate, days);
}

function makeOfficialCertificationDays() {
  return makeDaysFrom(ACTUAL_CERTIFICATION_START_DATE)
    .filter((day) => day <= actualCertificationEndDate);
}

function makeEmptyGrowthMetrics(): ParticipantGrowthMetrics {
  return {
    distanceKm: 0,
    durationSeconds: 0,
    maxSingleDistanceKm: 0,
    fiveKmCertificationCount: 0,
    tenKmCertificationCount: 0,
    halfMarathonCertificationCount: 0,
  };
}

function maxConsecutiveRecoveryDays(dates: string[]) {
  const sortedDates = Array.from(new Set(dates)).sort();
  let longest = 0;
  let current = 0;
  let previousDate = "";

  sortedDates.forEach((date) => {
    const isNextDay = previousDate
      ? Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previousDate}T00:00:00Z`) === 86_400_000
      : false;
    current = isNextDay ? current + 1 : 1;
    longest = Math.max(longest, current);
    previousDate = date;
  });

  return longest;
}

function gaugeColorClass(certifiedDays: number) {
  if (certifiedDays <= 10) return "bg-rose-400";
  if (certifiedDays <= 50) return "bg-amber-300";
  return "bg-lime-300";
}

function gaugeTextClass(certifiedDays: number) {
  if (certifiedDays <= 10) return "text-rose-600";
  if (certifiedDays <= 50) return "text-amber-700";
  return "text-lime-700";
}

const officialCertificationDays = makeOfficialCertificationDays();
const RING_CIRCUMFERENCE = 302;
const PUBLIC_DASHBOARD_STORAGE_KEY = "oriwan-public-dashboard-cache-v6-private-intros";
const LEGACY_PUBLIC_DASHBOARD_STORAGE_KEYS = [
  "oriwan-public-dashboard-cache-v4",
  "oriwan-public-dashboard-cache-v5-anonymized-names",
];
const PUBLIC_DASHBOARD_STORAGE_TTL_MS = 10 * 60 * 1000;
const PUBLIC_DASHBOARD_FOCUS_REFRESH_MS = 30 * 1000;
const PUBLIC_DASHBOARD_LIVE_REFRESH_MS = 30 * 1000;
const PERSONAL_GROWTH_BADGE_STORAGE_KEY = "oriwan-personal-growth-badges-v3";
const ONE_PLUS_ONE_DISMISS_STORAGE_KEY = "oriwan-one-plus-one-dismissed-v1";
const NEXT_SEASON_NOTICE_STORAGE_KEY = "oriwan-next-season-notice-2026-09-23-v1";
const FULL_HOUSE_FIREWORKS_STORAGE_KEY = "oriwan-full-house-fireworks-v1";
const FULL_HOUSE_FIREWORKS_DURATION_MS = 1900;
const ONE_PLUS_ONE_MILESTONES = new Set([40, 50, 60, 70, 80, 90]);
const STAMP_DOUBLE_EVENT_MILESTONES = ONE_PLUS_ONE_MILESTONES;
const FINAL_REPORT_MILESTONE_DAY = CHALLENGE_DAYS;
const JOURNEY_REPORT_DAY_COUNT = 50;
const JOURNEY_REPORT_TRIGGER_LABEL = "D-50";
const CERTIFICATION_SORT_DIRECTION_OPTIONS: { key: ParticipantRankSortDirection; label: string }[] = [
  { key: "desc", label: "높은순" },
  { key: "asc", label: "낮은순" },
];
const PARTICIPANT_METRIC_SORT_OPTIONS: { key: Exclude<ParticipantRankSortMode, "certification">; label: string }[] = [
  { key: "distance", label: "거리순" },
  { key: "duration", label: "시간순" },
];
const FULL_HOUSE_FIREWORK_BURSTS = [
  { x: "18%", y: "22%", delay: 0, hue: 82 },
  { x: "50%", y: "18%", delay: 110, hue: 44 },
  { x: "82%", y: "24%", delay: 40, hue: 146 },
  { x: "28%", y: "58%", delay: 190, hue: 196 },
  { x: "70%", y: "62%", delay: 230, hue: 318 },
  { x: "50%", y: "46%", delay: 320, hue: 26 },
];

type StoredGrowthBadges = Record<string, string[]>;

function clearLegacyPublicDashboardData() {
  LEGACY_PUBLIC_DASHBOARD_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

function readCachedDashboardData() {
  if (typeof window === "undefined") return null;

  try {
    clearLegacyPublicDashboardData();
    const raw = window.localStorage.getItem(PUBLIC_DASHBOARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; data?: PublicDashboardData };
    if (!parsed.savedAt || !parsed.data) return null;
    if (Date.now() - parsed.savedAt > PUBLIC_DASHBOARD_STORAGE_TTL_MS) return null;
    if (parsed.data.to !== toKstIsoDate()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedDashboardData(data: PublicDashboardData) {
  if (typeof window === "undefined") return;

  try {
    clearLegacyPublicDashboardData();
    window.localStorage.setItem(PUBLIC_DASHBOARD_STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      data,
    }));
  } catch {
    // Storage can fail in private mode. Network refresh still keeps the dashboard usable.
  }
}

function readStoredGrowthBadges(): StoredGrowthBadges {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(PERSONAL_GROWTH_BADGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([participantId, badgeKeys]) => participantId && Array.isArray(badgeKeys))
        .map(([participantId, badgeKeys]) => [
          participantId,
          Array.from(new Set((badgeKeys as unknown[]).filter((badgeKey): badgeKey is string => typeof badgeKey === "string"))),
        ])
    );
  } catch {
    return {};
  }
}

function writeStoredGrowthBadges(value: StoredGrowthBadges) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PERSONAL_GROWTH_BADGE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Badge locks are an enhancement; the dashboard should still render if storage is blocked.
  }
}

function onePlusOneDismissKey(day: number, date: string) {
  return `${date}:${day}`;
}

function readDismissedOnePlusOneEvent(day: number, date: string) {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(ONE_PLUS_ONE_DISMISS_STORAGE_KEY) === onePlusOneDismissKey(day, date);
  } catch {
    return false;
  }
}

function writeDismissedOnePlusOneEvent(day: number, date: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ONE_PLUS_ONE_DISMISS_STORAGE_KEY, onePlusOneDismissKey(day, date));
  } catch {
    // Dismissal is a convenience only; the event remains usable without storage.
  }
}

function isNextSeasonPreparationDate(date: string) {
  return date >= CHALLENGE_END_DATE && date <= NEXT_SEASON_START_DATE;
}

function readDismissedNextSeasonNotice(date: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(NEXT_SEASON_NOTICE_STORAGE_KEY) === date;
  } catch {
    return false;
  }
}

function writeDismissedNextSeasonNotice(date: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NEXT_SEASON_NOTICE_STORAGE_KEY, date);
  } catch {
    // The notice remains dismissible for the current page when storage is unavailable.
  }
}

function fullHouseFireworksKey(date: string) {
  return `${date}:full-house`;
}

function readShownFullHouseFireworks(date: string) {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(FULL_HOUSE_FIREWORKS_STORAGE_KEY) === fullHouseFireworksKey(date);
  } catch {
    return false;
  }
}

function writeShownFullHouseFireworks(date: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(FULL_HOUSE_FIREWORKS_STORAGE_KEY, fullHouseFireworksKey(date));
  } catch {
    // The animation is celebratory only; blocked storage should not affect the dashboard.
  }
}

function GrowthBadgeIcon({ icon }: { icon: PersonalGrowthBadge["icon"] }) {
  const iconClassName = "h-4 w-4";
  if (icon === "crown") return <span aria-hidden="true" className="text-lg leading-none">👑</span>;
  if (icon === "flame") return <IconFlame size={16} className={iconClassName} />;
  if (icon === "target") return <IconTarget size={16} className={iconClassName} />;
  if (icon === "calendar") return <IconCalendar size={16} className={iconClassName} />;
  if (icon === "sprout") return <IconSprout size={16} className={iconClassName} />;
  if (icon === "heart") return <IconHeart size={16} className={iconClassName} />;
  if (icon === "mountain") return <IconMountain size={16} className={iconClassName} />;
  if (icon === "muscle") return <IconMuscle size={16} className={iconClassName} />;
  if (icon === "droplet") return <IconDroplet size={16} className={iconClassName} />;
  if (icon === "sync") return <IconSync size={16} className={iconClassName} />;
  if (icon === "dna") return <IconDna size={16} className={iconClassName} />;
  return <IconRun size={16} className={iconClassName} />;
}

const BADGE_ACHIEVEMENT_BORDER_CLASS_BY_KEY: Partial<Record<PersonalGrowthBadge["key"], string>> = {
  "distance-four-hundred": "border-amber-300 ring-2 ring-amber-300/70 shadow-amber-300/25",
  "distance-five-hundred": "border-amber-300 ring-2 ring-amber-300/70 shadow-amber-300/25",
  "hundred-day-streak": "border-sky-400 ring-2 ring-sky-400/80 shadow-sky-500/30",
  "long-run-maker": "border-rose-400 ring-2 ring-rose-400/70 shadow-rose-400/25",
  "half-trigger": "border-rose-400 ring-2 ring-rose-400/70 shadow-rose-400/25",
  "season-pacer": "border-yellow-300 ring-2 ring-yellow-300/70 shadow-yellow-300/25",
  "fifty-day-core": "border-yellow-300 ring-2 ring-yellow-300/70 shadow-yellow-300/25",
  "seventy-day-arc": "border-yellow-300 ring-2 ring-yellow-300/70 shadow-yellow-300/25",
};

const BADGE_PREVIEW_BORDER_CLASS_BY_KEY: Partial<Record<PersonalGrowthBadge["key"], string>> = {
  "distance-four-hundred": "border-amber-300/75 ring-1 ring-amber-200/60",
  "distance-five-hundred": "border-amber-300/75 ring-1 ring-amber-200/60",
  "hundred-day-streak": "border-sky-400/90 ring-2 ring-sky-300/55 shadow-sky-200/45",
  "long-run-maker": "border-rose-300/75 ring-1 ring-rose-200/60",
  "half-trigger": "border-rose-300/75 ring-1 ring-rose-200/60",
  "season-pacer": "border-yellow-300/80 ring-1 ring-yellow-200/60",
  "fifty-day-core": "border-yellow-300/80 ring-1 ring-yellow-200/60",
  "seventy-day-arc": "border-yellow-300/80 ring-1 ring-yellow-200/60",
};

function badgeCardBorderClass(key: PersonalGrowthBadge["key"], unlocked: boolean) {
  if (unlocked) {
    return BADGE_ACHIEVEMENT_BORDER_CLASS_BY_KEY[key] || "border-lime-300 ring-2 ring-lime-300/80 shadow-lime-300/15";
  }

  return BADGE_PREVIEW_BORDER_CLASS_BY_KEY[key] || "border-transparent ring-1 ring-slate-950/5";
}

const RECENT_BADGE_DISPLAY_ORDER: PersonalGrowthBadge["key"][] = [
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
];

const RECENT_BADGE_LABEL_CLASS_BY_KEY: Partial<Record<PersonalGrowthBadge["key"], string>> = {
  "hundred-day-streak": "border-sky-400 bg-gradient-to-r from-sky-100 to-blue-100 text-blue-950 shadow-sky-300/50",
  "distance-four-hundred": "border-amber-300 bg-amber-50 text-amber-800 shadow-amber-200/40",
  "distance-five-hundred": "border-amber-300 bg-amber-50 text-amber-800 shadow-amber-200/40",
  "long-run-maker": "border-rose-300 bg-rose-50 text-rose-700 shadow-rose-200/40",
  "half-trigger": "border-rose-300 bg-rose-50 text-rose-700 shadow-rose-200/40",
  "season-pacer": "border-yellow-300 bg-yellow-50 text-yellow-800 shadow-yellow-200/40",
  "fifty-day-core": "border-yellow-300 bg-yellow-50 text-yellow-800 shadow-yellow-200/40",
  "seventy-day-arc": "border-yellow-300 bg-yellow-50 text-yellow-800 shadow-yellow-200/40",
};

function badgeDisplayOrderIndex(key: PersonalGrowthBadge["key"]) {
  const index = RECENT_BADGE_DISPLAY_ORDER.indexOf(key);
  if (key === "hundred-day-streak") return growthBadgeAcquisitionPriority(key);
  return index === -1 ? growthBadgeAcquisitionPriority(key) : index;
}

function recentBadgeLabelClass(key: PersonalGrowthBadge["key"]) {
  return RECENT_BADGE_LABEL_CLASS_BY_KEY[key] || "border-lime-300 bg-white text-slate-950 shadow-lime-200/35";
}

function badgeCardSurfaceClass(badge: PersonalGrowthBadge) {
  if (badge.key === "hundred-day-streak") {
    return badge.unlocked
      ? `badge-achieved-card bg-gradient-to-br from-sky-950 via-blue-900 to-indigo-900 text-white shadow-xl ${badgeCardBorderClass(badge.key, true)}`
      : `bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 text-blue-950 shadow-md ${badgeCardBorderClass(badge.key, false)}`;
  }

  return badge.unlocked
    ? `badge-achieved-card bg-slate-950 text-white shadow-lg ${badgeCardBorderClass(badge.key, true)}`
    : `bg-white/60 text-oriwan-text-muted ${badgeCardBorderClass(badge.key, false)}`;
}

function badgeIconSurfaceClass(badge: PersonalGrowthBadge) {
  if (badge.key === "hundred-day-streak") {
    return badge.unlocked
      ? "bg-sky-300 text-blue-950 shadow-md shadow-sky-400/40"
      : "bg-white text-blue-950 ring-1 ring-sky-300 shadow-sm shadow-sky-200/50";
  }

  return badge.unlocked
    ? "bg-lime-300 text-slate-950 shadow-sm shadow-lime-300/40"
    : "bg-white text-oriwan-text-muted ring-1 ring-slate-950/5";
}

function badgeStatusClass(badge: PersonalGrowthBadge) {
  if (badge.key === "hundred-day-streak") {
    return badge.unlocked
      ? "bg-sky-300 text-blue-950 shadow-sm shadow-sky-400/30"
      : "bg-sky-100 text-blue-950 ring-1 ring-sky-200";
  }

  return badge.unlocked
    ? "bg-lime-300 text-slate-950 shadow-sm shadow-lime-300/30"
    : "bg-oriwan-surface-light text-oriwan-text-muted";
}

function isRecoveryGrowthBadge(badge: PersonalGrowthBadge) {
  const text = `${badge.key} ${badge.label} ${badge.description}`.toLowerCase();
  return text.includes("recovery") || text.includes("리커버리") || text.includes("회복");
}

function makeGraphPath(items: { value: number }[], width = 320, height = 150, padding = 24) {
  if (!items.length) return { path: "", areaPath: "", points: [] as { x: number; y: number }[], width, height, padding };

  const points = items.map((item, index) => {
    const x = items.length === 1 ? width / 2 : padding + (index / (items.length - 1)) * (width - padding * 2);
    const y = height - padding - (Math.max(0, Math.min(item.value, 100)) / 100) * (height - padding * 2);
    return { x, y };
  });
  const path = points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const baseline = height - padding;
  const areaPath = points.length
    ? `${path} L ${points.at(-1)?.x.toFixed(1)} ${baseline.toFixed(1)} L ${points[0]?.x.toFixed(1)} ${baseline.toFixed(1)} Z`
    : "";
  return { path, areaPath, points, width, height, padding };
}

function AnimatedNumber({
  value,
  suffix = "",
  className = "",
  duration = 900,
}: {
  value: number;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      const frame = requestAnimationFrame(() => setDisplayValue(value));
      return () => cancelAnimationFrame(frame);
    }

    let animationFrame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [duration, value]);

  return <span className={`dashboard-number-pop ${className}`.trim()}>{displayValue}{suffix}</span>;
}

function FanfareBurst({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`fanfare-burst ${compact ? "fanfare-burst-compact" : ""}`} aria-hidden="true">
      {Array.from({ length: compact ? 10 : 16 }, (_, index) => (
        <span key={index} style={{ "--i": index } as CSSProperties} />
      ))}
    </div>
  );
}

function FullHouseFireworks() {
  return (
    <div className="full-house-fireworks" aria-hidden="true">
      {FULL_HOUSE_FIREWORK_BURSTS.map((burst, burstIndex) => (
        <span
          key={`${burst.x}-${burst.y}`}
          className="full-house-firework"
          style={{
            "--x": burst.x,
            "--y": burst.y,
            "--delay": `${burst.delay}ms`,
            "--hue": burst.hue,
          } as CSSProperties}
        >
          {Array.from({ length: 18 }, (_, index) => (
            <span key={`${burstIndex}-${index}`} style={{ "--i": index } as CSSProperties} />
          ))}
        </span>
      ))}
    </div>
  );
}

type MascotCoachMessage = {
  text: string;
  priority?: "daily";
};

type MascotCoachInput = {
  participantId: string;
  participantName: string;
  pictogramIndex: number;
  currentCertificationDate: string;
  rate: number;
  certifiedDays: number;
  currentStreak: number;
  longestStreak: number;
  recoveryUsageCount: number;
  todayCertified: boolean;
  missedDays: number;
  remainingDays: number;
  distanceKm: number;
};

const DEFAULT_MASCOT_COACH_MESSAGE: MascotCoachMessage = {
  text: "오늘의 몸 상태를 먼저 살피고, 가능한 만큼만 부드럽게 이어가요.",
};

function mascotCoachHash(value: string) {
  return Array.from(value).reduce((hash, char) => {
    return (hash * 33 + char.charCodeAt(0)) >>> 0;
  }, 5381);
}

function pickMascotCoachText(input: MascotCoachInput, salt: string, templates: string[]) {
  const displayName = `${input.participantName}님`;
  const flowKey = [
    input.currentCertificationDate,
    input.todayCertified ? "certified" : "pending",
    input.currentStreak,
    input.longestStreak,
    input.certifiedDays,
    input.missedDays,
    Math.floor(input.distanceKm / 10),
  ].join(":");
  const index = (mascotCoachHash(`${input.participantId}:${input.participantName}:${flowKey}:${salt}`) + input.pictogramIndex) % templates.length;
  return templates[index].replaceAll("{name}", displayName);
}

function rotateMascotCoachMessages(input: MascotCoachInput, messages: MascotCoachMessage[]) {
  if (messages.length <= 1) return messages;

  const rotate = (items: MascotCoachMessage[], salt: string) => {
    if (items.length <= 1) return items;
    const flowSeed = mascotCoachHash([
      input.participantId,
      input.currentCertificationDate,
      input.todayCertified ? "done" : "open",
      input.currentStreak,
      input.certifiedDays,
      input.missedDays,
      input.recoveryUsageCount,
      salt,
    ].join(":")) + input.pictogramIndex;
    const startIndex = flowSeed % items.length;

    return [...items.slice(startIndex), ...items.slice(0, startIndex)];
  };
  const dailyMessages = messages.filter((message) => message.priority === "daily");
  const regularMessages = messages.filter((message) => message.priority !== "daily");

  return [
    ...rotate(dailyMessages, "daily"),
    ...rotate(regularMessages, "regular"),
  ];
}

function makeMascotCoachMessages(input: MascotCoachInput) {
  const messages: MascotCoachMessage[] = [];

  if (input.todayCertified) {
    messages.push({
      priority: "daily",
      text: pickMascotCoachText(input, "today-done", [
        "{name}, 오늘 인증까지 잘 채웠어요. 몸이 기억할 만큼 좋은 흐름이에요.",
        "{name}, 오늘 칸이 예쁘게 채워졌어요. 스스로에게 다정하게 칭찬해줘도 좋아요.",
        "{name}, 오늘도 해냈어요. 작은 성실함이 아주 잘 쌓이고 있어요.",
        "{name}, 오늘 기록까지 확인됐어요. 컨디션 관리도 함께 잘 챙겨주세요.",
      ]),
    });
  } else {
    messages.push({
      priority: "daily",
      text: pickMascotCoachText(input, "today-empty", [
        "{name}, 오늘은 아직 비어 있어요. 컨디션을 먼저 보고 가능한 만큼만 움직여요.",
        "{name}, 아직 오늘 칸이 기다리고 있어요. 무리 없는 거리로 부드럽게 시작해요.",
        "{name}, 오늘 기록은 천천히 채워도 괜찮아요. 몸 상태를 먼저 살펴주세요.",
        "{name}, 가능하다면 가볍게 한 번 움직여봐요. 작은 인증도 흐름을 지켜줘요.",
      ]),
    });
  }

  if (input.todayCertified && input.currentStreak <= 1 && input.certifiedDays > 1) {
    messages.push({
      priority: "daily",
      text: pickMascotCoachText(input, "daily-comeback", [
        "{name}, 오늘 인증으로 흐름을 다시 붙였어요. 다시 시작한 하루가 아주 좋아요.",
        "{name}, 오늘 칸을 채우면서 다시 리듬이 열렸어요. 부담 없이 이어가면 돼요.",
        "{name}, 오늘 인증이 좋은 재시작점이 됐어요. 차분하게 다음 하루로 넘겨봐요.",
        "{name}, 끊겼던 흐름도 오늘 다시 이어졌어요. 다시 돌아온 힘이 충분히 좋아요.",
      ]),
    });
  } else if (input.todayCertified && input.currentStreak >= 2) {
    messages.push({
      priority: "daily",
      text: pickMascotCoachText(input, "daily-streak", [
        "{name}, 오늘 인증으로 연속 흐름이 이어졌어요. 지금 페이스를 편안히 지켜봐요.",
        "{name}, 오늘도 흐름을 놓치지 않았어요. 몸이 지치지 않게 부드럽게 이어가요.",
        "{name}, 연속 인증에 오늘 기록이 하나 더 쌓였어요. 안정적인 리듬이에요.",
        "{name}, 오늘까지 잘 이어졌어요. 이런 차분한 반복이 오래 가는 힘이 돼요.",
      ]),
    });
  } else if (!input.todayCertified && input.currentStreak === 0 && input.certifiedDays > 0) {
    messages.push({
      priority: "daily",
      text: pickMascotCoachText(input, "daily-pending-reset", [
        "{name}, 오늘은 아직 흐름이 비어 있어요. 가볍게라도 채우면 다시 리듬이 살아나요.",
        "{name}, 오늘 칸이 기다리고 있어요. 짧고 편한 러닝으로 다시 이어붙여도 좋아요.",
        "{name}, 아직 늦지 않았어요. 오늘 가능한 만큼만 움직여도 흐름을 되살릴 수 있어요.",
        "{name}, 오늘은 부담을 낮춰도 괜찮아요. 인증 한 칸이 다시 출발점이 될 수 있어요.",
      ]),
    });
  } else if (!input.todayCertified && input.currentStreak > 0) {
    messages.push({
      priority: "daily",
      text: pickMascotCoachText(input, "daily-pending-streak", [
        "{name}, 이어온 흐름이 있어요. 오늘도 무리 없는 인증으로 그 리듬을 지켜봐요.",
        "{name}, 지금까지의 연속 흐름이 좋아요. 오늘 칸도 편안하게 채워보면 좋겠어요.",
        "{name}, 좋은 리듬이 이어지고 있어요. 오늘은 몸 상태에 맞춰 부드럽게 가요.",
        "{name}, 오늘 인증만 더해지면 흐름이 계속 살아나요. 천천히 준비해도 괜찮아요.",
      ]),
    });
  }

  if (input.rate >= 100) {
    messages.push({
      text: pickMascotCoachText(input, "rate-100", [
        "{name}, 끝까지 해낸 기록이에요. 오래 지켜낸 마음이 정말 멋져요.",
        "{name}, 완주까지 차분히 이어온 힘이 보여요. 정말 자랑스러운 기록이에요.",
        "{name}, 마지막 칸까지 잘 도착했어요. 꾸준히 쌓아온 시간이 빛나요.",
        "{name}, 여기까지 온 과정이 그대로 힘이 됐어요. 충분히 크게 기뻐해도 좋아요.",
      ]),
    });
  } else if (input.rate >= 90) {
    messages.push({
      text: pickMascotCoachText(input, "rate-90", [
        "{name}, 마지막 구간까지 아주 가까이 왔어요. 오늘은 몸을 아끼며 차분히 가요.",
        "{name}, 거의 다 왔어요. 서두르지 말고 지금 페이스를 편안하게 지켜요.",
        "{name}, 마무리 구간일수록 더 부드럽게 가면 좋아요. 충분히 잘하고 있어요.",
        "{name}, 남은 칸이 얼마 없어요. 오늘도 안전하게 한 걸음만 더 이어가요.",
      ]),
    });
  } else if (input.rate >= 70) {
    messages.push({
      text: pickMascotCoachText(input, "rate-70", [
        "{name}, 꾸준함이 눈에 보이는 구간이에요. 지금 리듬을 편안하게 지켜가요.",
        "{name}, 이미 좋은 흐름을 만들고 있어요. 무리하지 않아도 충분히 단단해요.",
        "{name}, 쌓인 인증들이 안정적인 페이스를 보여줘요. 오늘도 차분히 이어가요.",
        "{name}, 여기까지 온 힘이 좋아요. 몸 상태를 살피면서 지금 흐름을 유지해요.",
      ]),
    });
  } else if (input.rate >= 50) {
    messages.push({
      text: pickMascotCoachText(input, "rate-50", [
        "{name}, 절반을 넘긴 힘이 이미 안에 있어요. 오늘도 내 호흡에 맞춰가요.",
        "{name}, 중간 구간을 잘 지나고 있어요. 조금 느려도 이어지는 게 중요해요.",
        "{name}, 지금까지의 기록이 충분히 좋은 기반이에요. 편안한 속도로 계속 가요.",
        "{name}, 절반을 지났다는 건 이미 리듬을 만들었다는 뜻이에요. 잘하고 있어요.",
      ]),
    });
  } else if (input.rate >= 30) {
    messages.push({
      text: pickMascotCoachText(input, "rate-30", [
        "{name}, 조금씩 리듬이 돌아오고 있어요. 완벽하지 않아도 이어가는 쪽이 더 강해요.",
        "{name}, 지금은 흐름을 다시 잡는 구간이에요. 오늘 한 칸이면 충분히 좋아요.",
        "{name}, 잘 따라오고 있어요. 부담을 낮추고 가능한 만큼만 부드럽게 가요.",
        "{name}, 아직 충분히 이어갈 수 있어요. 작게라도 움직이면 흐름이 살아나요.",
      ]),
    });
  } else if (input.certifiedDays > 0) {
    messages.push({
      text: pickMascotCoachText(input, "rate-low", [
        "{name}, 괜찮아요. 다시 시작하기에 늦은 날은 없어요. 오늘 한 칸만 채워봐요.",
        "{name}, 기록은 다시 이어갈 수 있어요. 오늘은 가볍게 몸을 깨우는 정도도 좋아요.",
        "{name}, 부담을 크게 잡지 않아도 돼요. 가능한 만큼만 해도 다시 흐름이 생겨요.",
        "{name}, 이미 시작한 힘이 있어요. 오늘은 그 힘을 살짝 다시 꺼내봐요.",
      ]),
    });
  } else {
    messages.push({
      text: pickMascotCoachText(input, "rate-zero", [
        "{name}, 첫 칸은 언제나 가장 중요해요. 아주 가볍게 시작해도 충분해요.",
        "{name}, 오늘은 부담 없이 몸을 움직여보는 날로 잡아도 좋아요.",
        "{name}, 시작은 크게 하지 않아도 괜찮아요. 편안한 첫 걸음이면 충분해요.",
        "{name}, 아직 늦지 않았어요. 작게 시작해서 내 리듬을 천천히 찾아봐요.",
      ]),
    });
  }

  if (input.currentStreak >= 10) {
    messages.push({
      text: pickMascotCoachText(input, "streak-10", [
        "{name}, 연속 인증이 단단하게 이어지고 있어요. 지금은 회복도 함께 챙기면 좋아요.",
        "{name}, 긴 흐름을 잘 만들었어요. 몸이 지치지 않게 페이스를 살짝 낮춰도 괜찮아요.",
        "{name}, 꾸준함이 아주 안정적이에요. 오늘은 가볍게 지켜내는 방식도 좋아요.",
      ]),
    });
  } else if (input.currentStreak >= 5) {
    messages.push({
      text: pickMascotCoachText(input, "streak-5", [
        "{name}, 며칠째 흐름이 이어지고 있어요. 아주 잘하고 있으니 오늘도 편안히 가요.",
        "{name}, 연속 인증의 감각이 좋아요. 무리 없이 이 리듬을 조금 더 지켜봐요.",
        "{name}, 좋은 습관이 붙고 있어요. 오늘도 내 몸에 맞는 페이스면 충분해요.",
      ]),
    });
  } else if (input.longestStreak >= 7) {
    messages.push({
      text: pickMascotCoachText(input, "longest-7", [
        "{name}, 이미 길게 이어본 힘이 있어요. 다시 리듬을 찾을 수 있는 사람이에요.",
        "{name}, 예전에 만든 좋은 흐름이 있어요. 오늘 한 칸부터 다시 이어가면 돼요.",
        "{name}, 한 번 해낸 경험은 남아 있어요. 차분하게 다시 몸을 깨워봐요.",
      ]),
    });
  }

  if (input.recoveryUsageCount > 0) {
    messages.push({
      text: pickMascotCoachText(input, "recovery-1", [
        "{name}, 리커버리 쉴드를 쓴 날도 잘 지킨 날이에요. 안전하게 이어가는 선택이 좋아요.",
        "{name}, 회복을 챙긴 것도 아주 좋은 판단이에요. 몸이 편해야 다시 잘 달릴 수 있어요.",
        "{name}, 쉬어가는 선택을 잘했어요. 오늘도 통증보다 안정감을 먼저 봐주세요.",
      ]),
    });
  }

  if (input.missedDays >= 10) {
    messages.push({
      text: pickMascotCoachText(input, "missed-10", [
        "{name}, 빈칸이 있어도 괜찮아요. 기록은 다시 돌아올 길을 보여주려고 있어요.",
        "{name}, 지난 빈칸보다 오늘 다시 채우는 한 칸이 더 중요해요. 천천히 가요.",
        "{name}, 놓친 날이 있어도 흐름은 다시 만들 수 있어요. 오늘부터 부드럽게 이어가요.",
      ]),
    });
  } else if (input.missedDays > 0) {
    messages.push({
      text: pickMascotCoachText(input, "missed-1", [
        "{name}, 몇 칸 비어 있어도 지금 채우는 한 칸이 제일 중요해요. 다시 이어갈 수 있어요.",
        "{name}, 빈칸이 조금 있어도 괜찮아요. 오늘의 움직임으로 흐름을 다시 살려봐요.",
        "{name}, 놓친 날은 지나갔고 오늘은 새로 채울 수 있어요. 부담 없이 가요.",
      ]),
    });
  }

  if (input.remainingDays <= 10 && input.remainingDays > 0) {
    messages.push({
      text: pickMascotCoachText(input, "remaining-10", [
        "{name}, 남은 날이 많지 않아요. 마지막까지 부드럽고 안전한 페이스로 함께 가요.",
        "{name}, 마무리 구간이에요. 조금 더 다정하게 몸을 챙기며 이어가요.",
        "{name}, 끝까지 잘 가려면 오늘도 무리 없는 선택이 좋아요. 차분히 가요.",
      ]),
    });
  }

  return rotateMascotCoachMessages(input, messages);
}

function MascotCoachButton({
  pictogramIndex,
  participantName,
  onNext,
}: {
  pictogramIndex: number;
  participantName: string;
  onNext: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onNext}
      className="mascot-coach-button"
      aria-label={`${participantName} 응원 멘트 바꾸기`}
      title="응원 멘트 바꾸기"
    >
      <MemberPictogram index={pictogramIndex} participantName={participantName} size="lg" />
    </button>
  );
}

function MascotCoachBubble({ message }: { message: MascotCoachMessage }) {
  return (
    <div className="mascot-coach-bubble" role="status" aria-live="polite">
      <p className="text-[12px] font-black leading-5 text-oriwan-text sm:text-[13px]">{message.text}</p>
    </div>
  );
}

type OnePlusOneEvent = {
  milestoneDay: number;
  timing: "today" | "tomorrow";
};

function getOnePlusOneEvent(referenceDate: string): OnePlusOneEvent | null {
  const dayNumber = certificationDayNumber(referenceDate);
  if (ONE_PLUS_ONE_MILESTONES.has(dayNumber)) return { milestoneDay: dayNumber, timing: "today" };
  if (ONE_PLUS_ONE_MILESTONES.has(dayNumber + 1)) return { milestoneDay: dayNumber + 1, timing: "tomorrow" };
  return null;
}

function OnePlusOneEventModal({
  event,
  onClose,
  onCloseToday,
}: {
  event: OnePlusOneEvent;
  onClose: () => void;
  onCloseToday: () => void;
}) {
  const timingLabel = event.timing === "today" ? "오늘" : "내일";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="one-plus-one-title"
      onClick={onClose}
    >
      <div
        className="card mobile-sheet modal-rise w-full max-w-lg overflow-y-auto p-4 sm:max-h-[88vh] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex rounded-full bg-lime-300 px-3 py-1 text-[11px] font-black text-slate-950">
              깜짝 이벤트 도착!
            </p>
            <h3 id="one-plus-one-title" className="mt-2 text-2xl font-black leading-tight text-oriwan-text">
              1+1 찬스 이벤트
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
            aria-label="닫기"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="space-y-4 text-sm font-bold leading-6 text-oriwan-text">
          <p>
            {timingLabel}은 스내사 챌린지 <span className="font-black text-lime-700">{event.milestoneDay}일차 보너스 데이</span>입니다.
          </p>
          <p>이벤트 당일 오전 9시 이전 기준으로 최소 3km 이상 인증을 완료한 멤버는 아래 2가지 중 하나를 선택할 수 있어요.</p>

          <div className="grid gap-2">
            {[
              ["1. 거리 2배", "당일에 달린 거리 × 2배"],
              ["2. 놓친 날짜 채우기", "당일 인증 + 이전에 놓친 날짜 1개를 100m / 1분"],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl bg-oriwan-surface-light px-4 py-3 ring-1 ring-slate-950/5">
                <p className="font-black text-oriwan-text">{title}</p>
                <p className="mt-0.5 text-xs font-bold text-oriwan-text-muted">{description}</p>
              </div>
            ))}
          </div>

          <div>
            <p>사용할 찬스를 카톡방에 짧게 남겨주세요.</p>
            <div className="mt-2 rounded-2xl bg-slate-950 px-4 py-3 font-mono text-sm font-black leading-7 text-lime-200">
              <p>거리 2배</p>
              <p>놓친 날짜 05.03</p>
            </div>
          </div>

          <p className="text-xs font-black text-oriwan-text-muted">선택 후 변경은 어려워요.</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCloseToday}
            className="rounded-2xl bg-oriwan-surface-light px-4 py-3 text-sm font-black text-oriwan-text transition hover:bg-slate-200"
          >
            오늘은 닫기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-lime-200 transition hover:bg-slate-800"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardClient({
  initialData = null,
  initialError = "",
  initialTodayIso,
  announcementsEnabled = true,
  liveDataEnabled = true,
  topSlot,
}: {
  initialData?: PublicDashboardData | null;
  initialError?: string;
  initialTodayIso: string;
  announcementsEnabled?: boolean;
  liveDataEnabled?: boolean;
  topSlot?: ReactNode;
}) {
  const [data, setData] = useState<PublicDashboardData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(initialError);
  const [todayIso, setTodayIso] = useState(() => initialData?.to || initialTodayIso);
  const [motionReady, setMotionReady] = useState(false);
  const [animationRun, setAnimationRun] = useState(0);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [selectedDailyRecordDate, setSelectedDailyRecordDate] = useState("");
  const [trendModal, setTrendModal] = useState<TrendModal>(null);
  const [showSeasonReportModal, setShowSeasonReportModal] = useState(false);
  const [showJourneyReportModal, setShowJourneyReportModal] = useState(false);
  const [showOnePlusOneEventModal, setShowOnePlusOneEventModal] = useState(false);
  const [showNextSeasonNotice, setShowNextSeasonNotice] = useState(false);
  const [showFinalReportPreviewModal, setShowFinalReportPreviewModal] = useState(false);
  const [showRecoveryVideos, setShowRecoveryVideos] = useState(false);
  const [showRecoveryTrend, setShowRecoveryTrend] = useState(false);
  const [showFullHouseFireworks, setShowFullHouseFireworks] = useState(false);
  const [participantSortMode, setParticipantSortMode] = useState<ParticipantRankSortMode>("certification");
  const [participantCertificationSortDirection, setParticipantCertificationSortDirection] = useState<ParticipantRankSortDirection>("desc");
  const [mascotCoachMessageIndex, setMascotCoachMessageIndex] = useState(0);
  const [, setStoredGrowthBadges] = useState<StoredGrowthBadges>({});
  const loadingRef = useRef(false);
  const lastLoadedAtRef = useRef(0);
  const motionFrameRef = useRef<number | null>(null);
  const nextSeasonNoticeClosedThisSessionRef = useRef(false);
  const onePlusOneEvent = useMemo(() => getOnePlusOneEvent(todayIso), [todayIso]);
  const closeNextSeasonNotice = useCallback(() => {
    nextSeasonNoticeClosedThisSessionRef.current = true;
    setShowNextSeasonNotice(false);
  }, []);
  const dismissNextSeasonNoticeToday = useCallback(() => {
    nextSeasonNoticeClosedThisSessionRef.current = true;
    writeDismissedNextSeasonNotice(todayIso);
    setShowNextSeasonNotice(false);
  }, [todayIso]);

  const restartMotion = useCallback(() => {
    if (motionFrameRef.current) window.cancelAnimationFrame(motionFrameRef.current);

    setAnimationRun((current) => current + 1);
    setMotionReady(false);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      motionFrameRef.current = window.requestAnimationFrame(() => setMotionReady(true));
      return;
    }

    motionFrameRef.current = window.requestAnimationFrame(() => {
      motionFrameRef.current = window.requestAnimationFrame(() => setMotionReady(true));
    });
  }, []);

  const load = useCallback(async (options?: { fresh?: boolean }) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setTodayIso(toKstIsoDate());
      const query = options?.fresh ? `?scope=all&refresh=1&at=${Date.now()}` : "?scope=all";
      const response = await fetch(`/api/public-dashboard${query}`, {
        cache: options?.fresh ? "no-store" : "default",
      });
      const json = await response.json().catch(() => ({ error: "팀 보드 응답을 읽지 못했어요." })) as PublicDashboardData;
      if (!response.ok) throw new Error(json.error || "오늘의 보드를 불러오지 못했어요.");
      setData(json);
      writeCachedDashboardData(json);
      lastLoadedAtRef.current = Date.now();
      restartMotion();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "대시보드를 불러오지 못했어요.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [restartMotion]);

  useEffect(() => {
    if (!liveDataEnabled) {
      queueMicrotask(() => {
        setStoredGrowthBadges(readStoredGrowthBadges());
        lastLoadedAtRef.current = Date.now();
        restartMotion();
      });
      return;
    }

    queueMicrotask(() => {
      setStoredGrowthBadges(readStoredGrowthBadges());
      const cachedData = readCachedDashboardData();
      if (!initialData && cachedData) {
        setData(cachedData);
        setError("");
        setLoading(false);
        lastLoadedAtRef.current = Date.now();
        restartMotion();
      }
      if (!initialData) void load({ fresh: true });
      if (initialData) {
        lastLoadedAtRef.current = Date.now();
        writeCachedDashboardData(initialData);
        restartMotion();
        void load({ fresh: true });
      }
    });
    const shouldRefresh = (minimumAgeMs = PUBLIC_DASHBOARD_FOCUS_REFRESH_MS) => (
      Date.now() - lastLoadedAtRef.current > minimumAgeMs
    );

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && shouldRefresh(PUBLIC_DASHBOARD_LIVE_REFRESH_MS)) load({ fresh: true });
    }, PUBLIC_DASHBOARD_LIVE_REFRESH_MS);
    const onFocus = () => {
      if (shouldRefresh()) load({ fresh: true });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && shouldRefresh()) load({ fresh: true });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initialData, liveDataEnabled, load, restartMotion]);

  useEffect(() => {
    if (!liveDataEnabled) return;

    try {
      const supabase = createClient();
      const channel = supabase
        .channel(DASHBOARD_REFRESH_CHANNEL)
        .on("broadcast", { event: DASHBOARD_REFRESH_EVENT }, () => {
          void load({ fresh: true });
        })
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      return;
    }
  }, [liveDataEnabled, load]);

  useEffect(() => {
    return () => {
      if (motionFrameRef.current) window.cancelAnimationFrame(motionFrameRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!announcementsEnabled) {
        setShowOnePlusOneEventModal(false);
        return;
      }
      if (!onePlusOneEvent) {
        setShowOnePlusOneEventModal(false);
        return;
      }

      setShowOnePlusOneEventModal(!readDismissedOnePlusOneEvent(onePlusOneEvent.milestoneDay, todayIso));
    });

    return () => {
      cancelled = true;
    };
  }, [announcementsEnabled, onePlusOneEvent, todayIso]);

  useEffect(() => {
    if (
      !announcementsEnabled ||
      !isNextSeasonPreparationDate(todayIso) ||
      nextSeasonNoticeClosedThisSessionRef.current ||
      readDismissedNextSeasonNotice(todayIso)
    ) return;
    if (
      showOnePlusOneEventModal ||
      showJourneyReportModal ||
      showSeasonReportModal ||
      showFinalReportPreviewModal ||
      Boolean(trendModal) ||
      Boolean(selectedDailyRecordDate)
    ) return;

    let cancelled = false;
    let timeout: number | undefined;
    const tryOpenNotice = () => {
      if (
        cancelled ||
        nextSeasonNoticeClosedThisSessionRef.current ||
        readDismissedNextSeasonNotice(todayIso)
      ) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        timeout = window.setTimeout(tryOpenNotice, 1000);
        return;
      }
      setShowNextSeasonNotice(true);
    };
    timeout = window.setTimeout(tryOpenNotice, 900);

    return () => {
      cancelled = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [
    announcementsEnabled,
    selectedDailyRecordDate,
    showFinalReportPreviewModal,
    showJourneyReportModal,
    showOnePlusOneEventModal,
    showSeasonReportModal,
    todayIso,
    trendModal,
  ]);

  const dashboard = useMemo(() => {
    const participants = data?.participants || [];
    const records = data?.records || [];
    const effectiveToday = todayIso > actualCertificationEndDate ? actualCertificationEndDate : todayIso;
    const certifiedRecords = records.filter((record) => isCertificationCountedStatus(record.status));
    const officialCertificationRecords = certifiedRecords.filter(
      (record) => Boolean(
        record.record_date &&
        record.record_date >= ACTUAL_CERTIFICATION_START_DATE &&
        record.record_date <= actualCertificationEndDate
      )
    );
    const officialRecoveryRecords = officialCertificationRecords.filter(isRecoveryCertificationRecord);
    const currentCertificationDate = effectiveToday;
    const currentDateRecords = officialCertificationRecords.filter((record) => record.record_date === currentCertificationDate);
    const currentDateCertifiedIds = new Set(
      currentDateRecords
        .filter((record) => record.participant_id)
        .map((record) => record.participant_id)
    );

    const completionRate = participants.length ? Math.round((currentDateCertifiedIds.size / participants.length) * 100) : 0;
    const pictogramByParticipantId = buildMemberPictogramMap(participants);

    const certifiedIdsByDay = new Map<string, Set<string>>();
    const certifiedDaysByParticipant = new Map<string, Set<string>>();
    const officialMetricsByParticipant = new Map<string, ParticipantGrowthMetrics>();
    const recoveryUsageByParticipant = new Map<string, number>();
    const recoveryIdsByDay = new Map<string, Set<string>>();
    const recoveryDatesByParticipant = new Map<string, Set<string>>();

    officialCertificationRecords.forEach((record) => {
      if (!record.participant_id || !record.record_date) return;
      if (!certifiedIdsByDay.has(record.record_date)) certifiedIdsByDay.set(record.record_date, new Set());
      certifiedIdsByDay.get(record.record_date)?.add(record.participant_id);

      if (!certifiedDaysByParticipant.has(record.participant_id)) certifiedDaysByParticipant.set(record.participant_id, new Set());
      certifiedDaysByParticipant.get(record.participant_id)?.add(record.record_date);
    });

    officialCertificationRecords.forEach((record) => {
      if (!record.participant_id || !record.record_date) return;

      const distanceKm = record.distance_km || 0;
      const metrics = officialMetricsByParticipant.get(record.participant_id) || makeEmptyGrowthMetrics();
      metrics.distanceKm += distanceKm;
      metrics.durationSeconds += record.duration_seconds || 0;
      metrics.maxSingleDistanceKm = Math.max(metrics.maxSingleDistanceKm, distanceKm);
      if (distanceKm >= 5) metrics.fiveKmCertificationCount += 1;
      if (distanceKm >= 10) metrics.tenKmCertificationCount += 1;
      if (distanceKm >= 21.1) metrics.halfMarathonCertificationCount += 1;
      officialMetricsByParticipant.set(record.participant_id, metrics);
    });

    officialRecoveryRecords.forEach((record) => {
      if (!record.participant_id || !record.record_date) return;
      recoveryUsageByParticipant.set(record.participant_id, (recoveryUsageByParticipant.get(record.participant_id) || 0) + 1);
      if (!recoveryIdsByDay.has(record.record_date)) recoveryIdsByDay.set(record.record_date, new Set());
      recoveryIdsByDay.get(record.record_date)?.add(record.participant_id);
      if (!recoveryDatesByParticipant.has(record.participant_id)) recoveryDatesByParticipant.set(record.participant_id, new Set());
      recoveryDatesByParticipant.get(record.participant_id)?.add(record.record_date);
    });

    const stampDatesByParticipant = new Map<string, Set<string>>();
    const stampRecordsByParticipant = new Map<string, Map<string, RunRecord>>();
    certifiedRecords.forEach((record) => {
      if (!record.participant_id || !record.record_date) return;
      if (!stampDatesByParticipant.has(record.participant_id)) stampDatesByParticipant.set(record.participant_id, new Set());
      stampDatesByParticipant.get(record.participant_id)?.add(record.record_date);
      if (!stampRecordsByParticipant.has(record.participant_id)) stampRecordsByParticipant.set(record.participant_id, new Map());
      stampRecordsByParticipant.get(record.participant_id)?.set(record.record_date, record);
    });

    const elapsedDays = officialCertificationDays.filter((day) => day <= currentCertificationDate);
    const dayTrend = elapsedDays.map((day) => {
      const certifiedCount = certifiedIdsByDay.get(day)?.size || 0;
      const rate = participants.length ? Math.round((certifiedCount / participants.length) * 100) : 0;
      return { day, certifiedCount, rate };
    });
    const recoveryDailyTrend = elapsedDays.map((date) => ({
      date,
      count: recoveryIdsByDay.get(date)?.size || 0,
    }));
    const recoveryMembers = participants
      .map((participant) => {
        const dates = Array.from(recoveryDatesByParticipant.get(participant.id) || []).sort();
        return {
          id: participant.id,
          name: participant.name,
          displayOrder: participant.display_order ?? Number.MAX_SAFE_INTEGER,
          dates,
          count: dates.length,
          maxConsecutive: maxConsecutiveRecoveryDays(dates),
        };
      })
      .filter((participant) => participant.count > 0)
      .sort((a, b) => (
        b.count - a.count ||
        a.displayOrder - b.displayOrder ||
        a.name.localeCompare(b.name, "ko")
      ));
    const recentWindowStart = toIsoDate(addDays(new Date(`${currentCertificationDate}T00:00:00`), -6));
    const previousWindowEnd = toIsoDate(addDays(new Date(`${recentWindowStart}T00:00:00`), -1));
    const previousWindowStart = toIsoDate(addDays(new Date(`${previousWindowEnd}T00:00:00`), -6));
    const membersBetween = (from: string, to: string) => (
      recoveryMembers.filter((participant) => participant.dates.some((date) => date >= from && date <= to))
    );
    const recentRecoveryMembers = membersBetween(recentWindowStart, currentCertificationDate);
    const previousRecoveryMembers = membersBetween(previousWindowStart, previousWindowEnd);
    const recoverySignalMetrics = {
      targetCount: participants.length,
      totalMembers: recoveryMembers,
      recentMembers: recentRecoveryMembers,
      recentNewMembers: recoveryMembers.filter((participant) => (
        Boolean(participant.dates[0]) &&
        participant.dates[0] >= recentWindowStart &&
        participant.dates[0] <= currentCertificationDate
      )),
      repeatMembers: recoveryMembers.filter((participant) => participant.count >= 3),
      consecutiveMembers: recoveryMembers.filter((participant) => participant.maxConsecutive >= 3),
      recentDelta: recentRecoveryMembers.length - previousRecoveryMembers.length,
      recentWindowStart,
      recoveryEndDate: currentCertificationDate,
    };
    const certifiedCountByDay = new Map(dayTrend.map((day) => [day.day, day.certifiedCount]));
    const visibleOfficialWeeks = Array.from({ length: Math.ceil(officialCertificationDays.length / 7) }, (_, index) => {
      const weekDays = officialCertificationDays.slice(index * 7, index * 7 + 7);
      return { index, weekDays };
    }).filter((week) => week.weekDays[0] && week.weekDays[0] <= currentCertificationDate);
    const weekTrend = visibleOfficialWeeks.map(({ index, weekDays }) => {
      const weekCertificationRecords = officialCertificationRecords.filter((record) => Boolean(record.record_date && weekDays.includes(record.record_date)));
      const elapsedWeekDays = weekDays.filter((day) => day <= currentCertificationDate);
      const certifiedSlots = weekDays.reduce((sum, day) => sum + (certifiedCountByDay.get(day) || 0), 0);
      const possibleSlots = weekDays.length * participants.length;
      const averageRate = possibleSlots ? Math.round((certifiedSlots / possibleSlots) * 100) : 0;
      const elapsedCertifiedSlots = elapsedWeekDays.reduce((sum, day) => sum + (certifiedCountByDay.get(day) || 0), 0);
      const elapsedPossibleSlots = elapsedWeekDays.length * participants.length;
      const reportRate = elapsedPossibleSlots ? Math.round((elapsedCertifiedSlots / elapsedPossibleSlots) * 100) : 0;
      const activeParticipantCount = new Set(weekCertificationRecords.map((record) => record.participant_id).filter(Boolean)).size;
      return {
        label: `${index + 1}주`,
        from: weekDays[0] || "",
        to: weekDays.at(-1) || "",
        averageRate,
        averageCount: weekDays.length ? Math.round(certifiedSlots / weekDays.length) : 0,
        certifiedSlots,
        elapsedCertifiedSlots,
        reportRate,
        activeParticipantCount,
        distanceKm: weekCertificationRecords.reduce((sum, record) => sum + (record.distance_km || 0), 0),
        durationSeconds: weekCertificationRecords.reduce((sum, record) => sum + (record.duration_seconds || 0), 0),
      };
    });
    const participantProgress = participants
      .map((participant) => {
        const certifiedDates = Array.from(certifiedDaysByParticipant.get(participant.id) || []).sort();
        const stampedDates = Array.from(stampDatesByParticipant.get(participant.id) || []).sort();
        const stampedRecords = Array.from(stampRecordsByParticipant.get(participant.id)?.values() || [])
          .sort((a, b) => (a.record_date || "").localeCompare(b.record_date || ""));
        const metrics = officialMetricsByParticipant.get(participant.id) || makeEmptyGrowthMetrics();
        const certifiedDays = certifiedDates.length;
        const rate = Math.min(Math.round((certifiedDays / CHALLENGE_DAYS) * 100), 100);
        const currentStreak = getCurrentDateStreak(certifiedDates, currentCertificationDate);
        const longestStreak = getLongestDateStreak(certifiedDates);
        const weekdayMorningCount = getWeekdayMorningProgress(certifiedDates, currentCertificationDate);
        const bestWeekdayMorningCount = getBestWeekdayMorningProgress(certifiedDates);
        return {
          participant,
          pictogramIndex: pictogramByParticipantId.get(participant.id) ?? 0,
          certifiedDates,
          stampedDates,
          stampedRecords,
          certifiedDays,
          currentStreak,
          longestStreak,
          weekdayMorningCount,
          bestWeekdayMorningCount,
          rate,
          recoveryUsageCount: recoveryUsageByParticipant.get(participant.id) || 0,
          ...metrics,
        };
      })
      .sort((a, b) => (
        b.certifiedDays - a.certifiedDays ||
        b.distanceKm - a.distanceKm ||
        b.durationSeconds - a.durationSeconds ||
        a.participant.name.localeCompare(b.participant.name, "ko")
      ));

    return {
      participants,
      currentCertificationDate,
      currentDateCertifiedIds,
      completionRate,
      elapsedDays,
      dayTrend,
      recoveryDailyTrend,
      recoverySignalMetrics,
      weekTrend,
      participantProgress,
      stampDays: makeDaysThrough(CERTIFICATION_DISPLAY_START_DATE, actualCertificationEndDate),
    };
  }, [data, todayIso]);

  useEffect(() => {
    if (!liveDataEnabled || !dashboard.participantProgress.length) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setStoredGrowthBadges((current) => {
        let changed = false;
        const next: StoredGrowthBadges = Object.fromEntries(
          Object.entries(current).map(([participantId, badgeKeys]) => [participantId, [...badgeKeys]])
        );

        dashboard.participantProgress.forEach((row) => {
          const unlockedKeys = makePersonalGrowthBadges({
            certifiedDays: row.certifiedDays,
            certifiedDates: row.certifiedDates,
            currentStreak: row.currentStreak,
            longestStreak: row.longestStreak,
            weekdayMorningCount: row.weekdayMorningCount,
            bestWeekdayMorningCount: row.bestWeekdayMorningCount,
            elapsedDayCount: dashboard.elapsedDays.length,
            distanceKm: row.distanceKm,
            durationSeconds: row.durationSeconds,
            maxSingleDistanceKm: row.maxSingleDistanceKm,
            fiveKmCertificationCount: row.fiveKmCertificationCount,
            tenKmCertificationCount: row.tenKmCertificationCount,
            halfMarathonCertificationCount: row.halfMarathonCertificationCount,
          }).filter((badge) => badge.unlocked).map((badge) => badge.key);

          if (!unlockedKeys.length) return;
          const badgeKeySet = new Set(next[row.participant.id] || []);
          unlockedKeys.forEach((badgeKey) => {
            if (badgeKeySet.has(badgeKey)) return;
            badgeKeySet.add(badgeKey);
            changed = true;
          });
          next[row.participant.id] = Array.from(badgeKeySet);
        });

        if (changed) writeStoredGrowthBadges(next);
        return changed ? next : current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [dashboard.elapsedDays.length, dashboard.participantProgress, liveDataEnabled]);

  const sortedParticipantProgress = useMemo(
    () => sortParticipantRanks(
      dashboard.participantProgress,
      participantSortMode,
      participantCertificationSortDirection
    ),
    [dashboard.participantProgress, participantCertificationSortDirection, participantSortMode]
  );
  const latestWeeklyRate = dashboard.weekTrend.at(-1)?.averageRate || 0;
  const latestDailyRate = dashboard.dayTrend.at(-1)?.rate || 0;
  const selectedParticipant = dashboard.participantProgress.find((row) => row.participant.id === selectedParticipantId) || null;
  const selectedStampedDates = new Set(selectedParticipant?.stampedDates || []);
  const selectedRecordByDate = new Map<string, RunRecord>(
    (selectedParticipant?.stampedRecords || [])
      .filter((record) => Boolean(record.record_date))
      .map((record) => [record.record_date as string, record])
  );
  const selectedDailyRecord = selectedDailyRecordDate ? selectedRecordByDate.get(selectedDailyRecordDate) : null;
  const selectedTodayCertified = selectedParticipant ? selectedStampedDates.has(dashboard.currentCertificationDate) : false;
  const selectedMissedDays = selectedParticipant ? Math.max(dashboard.elapsedDays.length - selectedParticipant.certifiedDays, 0) : 0;
  const selectedRemainingDays = selectedParticipant ? Math.max(CHALLENGE_DAYS - selectedParticipant.certifiedDays, 0) : 0;
  const selectedMascotCoachMessages = selectedParticipant ? makeMascotCoachMessages({
    participantId: selectedParticipant.participant.id,
    participantName: selectedParticipant.participant.name,
    pictogramIndex: selectedParticipant.pictogramIndex,
    currentCertificationDate: dashboard.currentCertificationDate,
    rate: selectedParticipant.rate,
    certifiedDays: selectedParticipant.certifiedDays,
    currentStreak: selectedParticipant.currentStreak,
    longestStreak: selectedParticipant.longestStreak,
    recoveryUsageCount: selectedParticipant.recoveryUsageCount,
    todayCertified: selectedTodayCertified,
    missedDays: selectedMissedDays,
    remainingDays: selectedRemainingDays,
    distanceKm: selectedParticipant.distanceKm,
  }) : [DEFAULT_MASCOT_COACH_MESSAGE];
  const selectedMascotCoachMessage = selectedMascotCoachMessages.length
    ? selectedMascotCoachMessages[mascotCoachMessageIndex % selectedMascotCoachMessages.length] ?? DEFAULT_MASCOT_COACH_MESSAGE
    : DEFAULT_MASCOT_COACH_MESSAGE;
  const persistedGrowthBadgeKeysByParticipant = useMemo(() => {
    const badgeKeysByParticipant = new Map<string, Set<string>>();
    const add = (participantId: string | null | undefined, badgeKey: string | null | undefined) => {
      if (!participantId || !badgeKey) return;
      if (!badgeKeysByParticipant.has(participantId)) badgeKeysByParticipant.set(participantId, new Set());
      badgeKeysByParticipant.get(participantId)?.add(badgeKey);
    };

    data?.growth_badges?.forEach((badge) => add(badge.participant_id, badge.badge_key));
    return badgeKeysByParticipant;
  }, [data?.growth_badges]);
  const latestGrowthBadgeByParticipant = useMemo(() => {
    const earnedAtByParticipant = new Map<string, Map<string, string>>();
    data?.growth_badges?.forEach((badge) => {
      if (!badge.participant_id || !badge.badge_key || !badge.earned_at) return;
      if (!earnedAtByParticipant.has(badge.participant_id)) earnedAtByParticipant.set(badge.participant_id, new Map());
      earnedAtByParticipant.get(badge.participant_id)?.set(badge.badge_key, badge.earned_at);
    });

    return dashboard.participantProgress.reduce((latestByParticipant, row) => {
      const persistedBadgeKeys = persistedGrowthBadgeKeysByParticipant.get(row.participant.id) || new Set<string>();
      const earnedAtByBadgeKey = earnedAtByParticipant.get(row.participant.id) || new Map<string, string>();
      const recentBadge = makePersonalGrowthBadges({
        certifiedDays: row.certifiedDays,
        certifiedDates: row.certifiedDates,
        currentStreak: row.currentStreak,
        longestStreak: row.longestStreak,
        weekdayMorningCount: row.weekdayMorningCount,
        bestWeekdayMorningCount: row.bestWeekdayMorningCount,
        elapsedDayCount: dashboard.elapsedDays.length,
        distanceKm: row.distanceKm,
        durationSeconds: row.durationSeconds,
        maxSingleDistanceKm: row.maxSingleDistanceKm,
        fiveKmCertificationCount: row.fiveKmCertificationCount,
        tenKmCertificationCount: row.tenKmCertificationCount,
        halfMarathonCertificationCount: row.halfMarathonCertificationCount,
      })
        .filter((badge) => (badge.unlocked || persistedBadgeKeys.has(badge.key)) && !isRecoveryGrowthBadge(badge))
        .sort((left, right) => {
          const leftTime = Date.parse(earnedAtByBadgeKey.get(left.key) || "") || 0;
          const rightTime = Date.parse(earnedAtByBadgeKey.get(right.key) || "") || 0;
          if (leftTime !== rightTime) return rightTime - leftTime;
          return badgeDisplayOrderIndex(right.key) - badgeDisplayOrderIndex(left.key);
        })[0];

      if (recentBadge) latestByParticipant.set(row.participant.id, recentBadge);
      return latestByParticipant;
    }, new Map<string, PersonalGrowthBadge>());
  }, [dashboard.elapsedDays.length, dashboard.participantProgress, data?.growth_badges, persistedGrowthBadgeKeysByParticipant]);
  const selectedPersistedGrowthBadgeKeys = selectedParticipant
    ? persistedGrowthBadgeKeysByParticipant.get(selectedParticipant.participant.id) || new Set<string>()
    : new Set<string>();
  const selectedPersonalGrowthBadges = selectedParticipant ? makePersonalGrowthBadges({
    certifiedDays: selectedParticipant.certifiedDays,
    certifiedDates: selectedParticipant.certifiedDates,
    currentStreak: selectedParticipant.currentStreak,
    longestStreak: selectedParticipant.longestStreak,
    weekdayMorningCount: selectedParticipant.weekdayMorningCount,
    bestWeekdayMorningCount: selectedParticipant.bestWeekdayMorningCount,
    elapsedDayCount: dashboard.elapsedDays.length,
    distanceKm: selectedParticipant.distanceKm,
    durationSeconds: selectedParticipant.durationSeconds,
    maxSingleDistanceKm: selectedParticipant.maxSingleDistanceKm,
    fiveKmCertificationCount: selectedParticipant.fiveKmCertificationCount,
    tenKmCertificationCount: selectedParticipant.tenKmCertificationCount,
    halfMarathonCertificationCount: selectedParticipant.halfMarathonCertificationCount,
  }).map((badge) => {
    const persistentlyUnlocked = selectedPersistedGrowthBadgeKeys.has(badge.key);
    return {
      ...badge,
      progress: persistentlyUnlocked && !badge.unlocked ? "획득" : badge.progress,
      unlocked: badge.unlocked || persistentlyUnlocked,
    };
  }) : [];
  const unlockedSelectedBadgeCount = selectedPersonalGrowthBadges.filter((badge) => badge.unlocked).length;
  const remainingSeasonDays = Math.max(CHALLENGE_DAYS - dashboard.elapsedDays.length, 0);
  const showJourneyReportLabel = (
    dashboard.currentCertificationDate === todayIso &&
    certificationDayLabel(dashboard.currentCertificationDate) === JOURNEY_REPORT_TRIGGER_LABEL &&
    dashboard.elapsedDays.length >= JOURNEY_REPORT_DAY_COUNT
  );
  const journeyReport = useMemo(() => {
    const reportDays = officialCertificationDays
      .slice(0, JOURNEY_REPORT_DAY_COUNT)
      .filter((day) => day <= dashboard.currentCertificationDate);
    const reportDaySet = new Set(reportDays);
    const reportTrend = dashboard.dayTrend.filter((day) => reportDaySet.has(day.day));
    const certificationRecords = (data?.records || []).filter((record) => (
      isCertificationCountedStatus(record.status) &&
      Boolean(record.record_date && reportDaySet.has(record.record_date))
    ));
    const officialRecords = certificationRecords;
    const certifiedSlots = reportTrend.reduce((sum, day) => sum + day.certifiedCount, 0);
    const possibleSlots = reportDays.length * dashboard.participants.length;
    const teamRate = possibleSlots ? Math.round((certifiedSlots / possibleSlots) * 100) : 0;
    const totalDistanceKm = officialRecords.reduce((sum, record) => sum + (record.distance_km || 0), 0);
    const totalDurationSeconds = officialRecords.reduce((sum, record) => sum + (record.duration_seconds || 0), 0);
    const certifiedDateByParticipant = new Map<string, Set<string>>();
    const recordsByParticipant = new Map<string, RunRecord[]>();
    const spaceTotals = new Map<string, {
      label: string;
      count: number;
      distanceKm: number;
      durationSeconds: number;
      participantIds: Set<string>;
    }>();

    certificationRecords.forEach((record) => {
      if (!record.participant_id || !record.record_date) return;
      if (!certifiedDateByParticipant.has(record.participant_id)) certifiedDateByParticipant.set(record.participant_id, new Set());
      certifiedDateByParticipant.get(record.participant_id)?.add(record.record_date);
    });

    officialRecords.forEach((record) => {
      if (!record.participant_id || !record.record_date) return;
      if (!recordsByParticipant.has(record.participant_id)) recordsByParticipant.set(record.participant_id, []);
      recordsByParticipant.get(record.participant_id)?.push(record);

      if (record.space_label) {
        const space = spaceTotals.get(record.space_label) || {
          label: record.space_label,
          count: 0,
          distanceKm: 0,
          durationSeconds: 0,
          participantIds: new Set<string>(),
        };
        space.count += 1;
        space.distanceKm += record.distance_km || 0;
        space.durationSeconds += record.duration_seconds || 0;
        space.participantIds.add(record.participant_id);
        spaceTotals.set(record.space_label, space);
      }
    });

    const participantStats = dashboard.participants.map((participant) => {
      const participantRecords = recordsByParticipant.get(participant.id) || [];
      const certifiedDates = Array.from(certifiedDateByParticipant.get(participant.id) || []).sort();
      const distanceKm = participantRecords.reduce((sum, record) => sum + (record.distance_km || 0), 0);
      const durationSeconds = participantRecords.reduce((sum, record) => sum + (record.duration_seconds || 0), 0);
      const maxSingleDistanceKm = participantRecords.reduce((max, record) => Math.max(max, record.distance_km || 0), 0);
      const tenKmCount = participantRecords.filter((record) => (record.distance_km || 0) >= 10).length;
      const halfCount = participantRecords.filter((record) => (record.distance_km || 0) >= 21.1).length;
      return {
        participant,
        certifiedDays: certifiedDates.length,
        distanceKm,
        durationSeconds,
        maxSingleDistanceKm,
        tenKmCount,
        halfCount,
        longestStreak: getLongestDateStreak(certifiedDates),
      };
    });
    const averageCertifiedDays = dashboard.participants.length
      ? Math.round(certifiedSlots / dashboard.participants.length)
      : 0;
    const sortByName = (a: { participant: Participant }, b: { participant: Participant }) => a.participant.name.localeCompare(b.participant.name, "ko");
    const topBy = (value: (stat: typeof participantStats[number]) => number) => (
      [...participantStats]
        .filter((stat) => value(stat) > 0)
        .sort((a, b) => value(b) - value(a) || sortByName(a, b))[0] || null
    );
    const topGroupBy = (value: (stat: typeof participantStats[number]) => number) => {
      const candidates = participantStats.filter((stat) => value(stat) > 0);
      const topValue = candidates.reduce((max, stat) => Math.max(max, value(stat)), 0);
      return candidates
        .filter((stat) => value(stat) === topValue)
        .sort(sortByName);
    };
    const leaderNames = (stats: typeof participantStats) => stats.map((stat) => stat.participant.name).join(", ");
    const certifiedLeaders = topGroupBy((stat) => stat.certifiedDays);
    const streakLeaders = topGroupBy((stat) => stat.longestStreak);
    const distanceLeader = topBy((stat) => stat.distanceKm);
    const durationLeader = topBy((stat) => stat.durationSeconds);
    const singleDistanceLeader = topBy((stat) => stat.maxSingleDistanceKm);
    const tenKmLeader = topBy((stat) => stat.tenKmCount);
    const leaderCards = [
      certifiedLeaders.length && {
        label: "최대 인증",
        name: leaderNames(certifiedLeaders),
        value: `${certifiedLeaders[0]?.certifiedDays || 0}/${reportDays.length}회`,
        detail: `${certifiedLeaders.length > 1 ? `동률 ${certifiedLeaders.length}명 · ` : ""}50일 중 미인증 ${reportDays.length - (certifiedLeaders[0]?.certifiedDays || 0)}회`,
      },
      distanceLeader && {
        label: "누적 거리 1등",
        name: distanceLeader.participant.name,
        value: `${formatCompactNumber(distanceLeader.distanceKm, 1)}km`,
        detail: `팀 거리의 ${totalDistanceKm ? Math.round((distanceLeader.distanceKm / totalDistanceKm) * 100) : 0}%`,
      },
      durationLeader && {
        label: "누적 시간 1등",
        name: durationLeader.participant.name,
        value: formatTeamDuration(durationLeader.durationSeconds),
        detail: "가장 오래 루틴을 붙잡은 멤버",
      },
      streakLeaders.length && {
        label: "연속 인증",
        name: leaderNames(streakLeaders),
        value: `${streakLeaders[0]?.longestStreak || 0}일`,
        detail: `${streakLeaders.length > 1 ? `동률 ${streakLeaders.length}명 · ` : ""}가장 길게 끊기지 않은 흐름`,
      },
      singleDistanceLeader && {
        label: "하루 최장거리 1등",
        name: singleDistanceLeader.participant.name,
        value: `${formatCompactNumber(singleDistanceLeader.maxSingleDistanceKm, 1)}km`,
        detail: "하루에 가장 멀리 달린 기록",
      },
      tenKmLeader && {
        label: "롱런 1등",
        name: tenKmLeader.participant.name,
        value: `${tenKmLeader.tenKmCount}회`,
        detail: "10km 이상 인증 횟수 기준",
      },
    ].filter(Boolean) as { label: string; name: string; value: string; detail: string }[];
    const effortCards = [...participantStats]
      .filter((stat) => stat.certifiedDays < reportDays.length)
      .sort((a, b) => a.certifiedDays - b.certifiedDays || a.distanceKm - b.distanceKm || sortByName(a, b))
      .slice(0, 1)
      .map((stat) => {
        const gapToAverage = Math.max(averageCertifiedDays - stat.certifiedDays, 0);
        const missedDays = Math.max(reportDays.length - stat.certifiedDays, 0);
        const rate = reportDays.length ? Math.round((stat.certifiedDays / reportDays.length) * 100) : 0;
        return {
          name: stat.participant.name,
          value: `${rate}%`,
          detail: gapToAverage
            ? `${stat.certifiedDays}/${reportDays.length}회 · 팀 평균까지 ${gapToAverage}회`
            : `${stat.certifiedDays}/${reportDays.length}회 · 미인증 ${missedDays}회`,
        };
      });
    const spaceGroups = Array.from(spaceTotals.values())
      .sort((a, b) => b.count - a.count || b.distanceKm - a.distanceKm || a.label.localeCompare(b.label, "ko"))
      .slice(0, 8)
      .map((space) => ({
        label: space.label,
        count: space.count,
        distanceKm: space.distanceKm,
        participantCount: space.participantIds.size,
      }));
    const perfectMemberCount = dashboard.participants.filter((participant) => (
      (certifiedDateByParticipant.get(participant.id)?.size || 0) >= reportDays.length &&
      reportDays.length >= JOURNEY_REPORT_DAY_COUNT
    )).length;

    return {
      averageCertifiedDays,
      certifiedSlots,
      effortCards,
      from: reportDays[0] || dashboard.currentCertificationDate,
      leaderCards,
      perfectMemberCount,
      possibleSlots,
      reportDays,
      spaceGroups,
      teamRate,
      to: reportDays.at(-1) || dashboard.currentCertificationDate,
      totalDistanceKm,
      totalDurationSeconds,
    };
  }, [
    dashboard.currentCertificationDate,
    dashboard.dayTrend,
    dashboard.participants,
    data?.records,
  ]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setMascotCoachMessageIndex(0);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedParticipantId]);

  useEffect(() => {
    if (showJourneyReportLabel) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setShowJourneyReportModal(false);
    });

    return () => {
      cancelled = true;
    };
  }, [showJourneyReportLabel]);

  const trendItems = trendModal === "weekly"
    ? dashboard.weekTrend.map((week) => ({
      label: week.label,
      value: week.averageRate,
      caption: week.to ? `${week.label} · ${shortDate(week.from)}-${shortDate(week.to)}` : week.label,
    }))
    : dashboard.dayTrend.map((day) => ({
      label: shortDate(day.day),
      value: day.rate,
      caption: `${shortDate(day.day)} · ${day.certifiedCount}/${dashboard.participants.length}명`,
    }));
  const trendGraph = makeGraphPath(trendItems, 680, 260, 36);
  const isInitialDashboardLoading = loading && !data;

  useEffect(() => {
    const fullHouseAchieved = (
      dashboard.participants.length > 0 &&
      dashboard.currentCertificationDate === todayIso &&
      dashboard.currentDateCertifiedIds.size >= dashboard.participants.length &&
      dashboard.completionRate >= 100
    );
    if (!fullHouseAchieved || readShownFullHouseFireworks(todayIso)) return;

    let hideTimeout: number | undefined;
    const showTimeout = window.setTimeout(() => {
      if (readShownFullHouseFireworks(todayIso)) return;
      writeShownFullHouseFireworks(todayIso);
      setShowFullHouseFireworks(true);
      hideTimeout = window.setTimeout(() => setShowFullHouseFireworks(false), FULL_HOUSE_FIREWORKS_DURATION_MS);
    }, 0);

    return () => {
      window.clearTimeout(showTimeout);
      if (hideTimeout !== undefined) window.clearTimeout(hideTimeout);
    };
  }, [
    dashboard.completionRate,
    dashboard.currentCertificationDate,
    dashboard.currentDateCertifiedIds.size,
    dashboard.participants.length,
    todayIso,
  ]);

  return (
    <main className="w-full overflow-x-hidden bg-oriwan-bg">
      {showFullHouseFireworks && <FullHouseFireworks />}

      <section className="mx-auto w-full max-w-7xl px-0 py-0 sm:px-4 sm:py-6">
        {topSlot}
        <section className="overflow-hidden bg-white sm:rounded-[32px] sm:shadow-2xl sm:shadow-slate-950/10 sm:ring-1 sm:ring-slate-950/5">
          <div className="overflow-hidden bg-[#101522] px-4 py-5 text-white sm:p-7">
            <div className="mx-auto max-w-6xl">
              <div className="mb-5 flex min-w-0 items-center justify-between gap-3 sm:mb-6">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="max-w-full whitespace-nowrap text-[clamp(2.05rem,8.8vw,3.75rem)] font-black leading-[1.04] text-white">
                    오늘의 인증
                  </h2>
                  {showJourneyReportLabel && (
                    <button
                      type="button"
                      onClick={() => setShowJourneyReportModal(true)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime-300 px-3 py-1.5 text-[10px] font-black text-slate-950 shadow-sm shadow-lime-300/30 ring-1 ring-lime-200 transition hover:-translate-y-0.5 hover:bg-lime-200 sm:text-xs"
                      aria-label="50일간의 여정 열기"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                      50일간의 여정
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1.5 sm:gap-2">
                  <p className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black text-lime-200 ring-1 ring-white/10 sm:px-4 sm:text-xs">
                    {shortDate(dashboard.currentCertificationDate)}
                  </p>
                  <p className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-lime-300 px-3 py-1.5 text-[10px] font-black text-slate-950 shadow-sm shadow-lime-300/30 sm:px-4 sm:text-xs">
                    {certificationDayLabel(dashboard.currentCertificationDate)}
                  </p>
                </div>
              </div>

              <div className="w-full rounded-[24px] bg-white/10 p-4 ring-1 ring-white/10 shadow-2xl shadow-slate-950/20 sm:rounded-[30px] sm:p-5 lg:ml-auto lg:max-w-[27rem] lg:p-6">
                <div className="flex items-center justify-between gap-4 sm:gap-5">
                  <div className="min-w-0">
                    <p className="text-[clamp(3.25rem,13vw,4.9rem)] font-black leading-none text-lime-200">
                      {isInitialDashboardLoading ? "--" : <AnimatedNumber key={`hero-rate-${animationRun}`} value={dashboard.completionRate} suffix="%" />}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-white/55 sm:text-sm">
                      {isInitialDashboardLoading ? "인증 현황 불러오는 중" : `${dashboard.currentDateCertifiedIds.size}/${dashboard.participants.length}명 인증 완료`}
                    </p>
                  </div>
                  <svg key={`hero-ring-${animationRun}`} viewBox="0 0 120 120" className="h-[clamp(5.75rem,24vw,8.5rem)] w-[clamp(5.75rem,24vw,8.5rem)] shrink-0 -rotate-90 dashboard-ring-pop">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="14" className="dashboard-ring-track" />
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke="#bef264"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      strokeDashoffset={RING_CIRCUMFERENCE - ((motionReady ? dashboard.completionRate : 0) / 100) * RING_CIRCUMFERENCE}
                      className="dashboard-ring-sweep transition-[stroke-dashoffset] duration-[900ms] ease-out"
                    />
                  </svg>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setShowSeasonReportModal(true)}
                  className="dashboard-card-reveal min-w-0 rounded-2xl bg-white/10 px-1.5 py-2.5 text-center ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-lime-300 sm:rounded-3xl sm:px-3 sm:py-4 [animation-delay:0ms]"
                >
                  <p className="truncate text-[10px] font-black text-white/50">진행일</p>
                  <p className="mt-1 whitespace-nowrap text-[1.25rem] font-black leading-tight text-white sm:text-2xl">
                    <AnimatedNumber key={`elapsed-${animationRun}`} value={dashboard.elapsedDays.length} />/{CHALLENGE_DAYS}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setTrendModal("weekly")}
                  className="dashboard-card-reveal min-w-0 rounded-2xl bg-white/10 px-1.5 py-2.5 text-center ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-lime-300 sm:rounded-3xl sm:px-3 sm:py-4 [animation-delay:90ms]"
                >
                  <p className="truncate text-[10px] font-black text-white/50">주차별 인증률</p>
                  <p className="mt-1 whitespace-nowrap text-[1.25rem] font-black leading-tight text-white sm:text-2xl">
                    {isInitialDashboardLoading ? "--" : <AnimatedNumber key={`weekly-${animationRun}`} value={latestWeeklyRate} suffix="%" />}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setTrendModal("daily")}
                  className="dashboard-card-reveal min-w-0 rounded-2xl bg-lime-300 px-1.5 py-2.5 text-center text-slate-950 shadow-sm shadow-lime-300/30 transition hover:-translate-y-0.5 hover:ring-2 hover:ring-lime-400 sm:rounded-3xl sm:px-3 sm:py-4 [animation-delay:180ms]"
                >
                  <p className="truncate text-[10px] font-black opacity-60">매일 인증률</p>
                  <p className="mt-1 whitespace-nowrap text-[1.25rem] font-black leading-tight sm:text-2xl">
                    {isInitialDashboardLoading ? "--" : <AnimatedNumber key={`daily-${animationRun}`} value={latestDailyRate} suffix="%" />}
                  </p>
                </button>
              </div>
            </div>
          </div>

          <div className="p-2.5 sm:p-5">
            <div>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h4 className="text-base font-black leading-tight text-oriwan-text">스내사 크루별 인증 현황</h4>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-full bg-oriwan-surface-light p-1 ring-1 ring-slate-950/5">
                    {CERTIFICATION_SORT_DIRECTION_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setParticipantSortMode("certification");
                          setParticipantCertificationSortDirection(option.key);
                        }}
                        aria-pressed={participantSortMode === "certification" && participantCertificationSortDirection === option.key}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-black transition ${
                          participantSortMode === "certification" && participantCertificationSortDirection === option.key
                            ? "bg-lime-300 text-slate-950 shadow-sm"
                            : "text-oriwan-text-muted hover:text-oriwan-text"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex rounded-full bg-oriwan-surface-light p-1 ring-1 ring-slate-950/5">
                    {PARTICIPANT_METRIC_SORT_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setParticipantSortMode(option.key)}
                        aria-pressed={participantSortMode === option.key}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-black transition ${
                          participantSortMode === option.key
                            ? "bg-lime-300 text-slate-950 shadow-sm"
                            : "text-oriwan-text-muted hover:text-oriwan-text"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <span className="inline-flex shrink-0 rounded-full bg-lime-300 px-3 py-1 text-[11px] font-black text-slate-950 shadow-sm shadow-lime-300/30">
                    {isInitialDashboardLoading ? "멤버 불러오는 중" : `멤버 ${dashboard.participants.length}명`}
                  </span>
                </div>
              </div>
              <div className="grid gap-2">
                {isInitialDashboardLoading && Array.from({ length: 6 }, (_, index) => (
                  <div key={`dashboard-loading-${index}`} className="rounded-[18px] bg-white px-3 py-3 ring-1 ring-slate-950/5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-oriwan-surface-light" />
                        <span className="grid min-w-0 flex-1 gap-1.5">
                          <span className="block h-3 w-24 animate-pulse rounded-full bg-oriwan-surface-light" />
                          <span className="block h-2 w-full animate-pulse rounded-full bg-oriwan-surface-light" />
                        </span>
                      </div>
                      <span className="h-6 w-12 shrink-0 animate-pulse rounded-full bg-oriwan-surface-light" />
                    </div>
                  </div>
                ))}
                {sortedParticipantProgress.map((row, index) => {
                  const latestBadge = latestGrowthBadgeByParticipant.get(row.participant.id);
                  const latestBadgeLabel = latestBadge?.key === "hundred-day-streak" ? "100일 인증" : latestBadge?.label;
                  return (
                  <button
                    key={row.participant.id}
                    type="button"
                    onClick={() => {
                      setSelectedParticipantId(row.participant.id);
                      setSelectedDailyRecordDate("");
                      setShowFinalReportPreviewModal(false);
                    }}
                    className={`relative overflow-hidden rounded-[18px] bg-white px-3 py-3 text-left ring-1 ring-slate-950/5 transition hover:-translate-y-0.5 hover:ring-lime-300 sm:px-4 ${
                    row.rate >= 100 ? "gauge-complete-card" : "dashboard-gauge-card"
                    }`}
                  >
                    {row.rate >= 100 && <FanfareBurst compact />}
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 sm:gap-3">
                      <div className="relative flex min-w-[44px] shrink-0 justify-center pt-2">
                        {latestBadge && (
                          <span
                            title={latestBadge.label}
                            className={`absolute left-1/2 top-0 z-10 inline-flex -translate-x-1/2 items-center rounded-full border py-0.5 font-black leading-none shadow-sm ${
                              latestBadge.key === "hundred-day-streak"
                                ? "max-w-[60px] gap-0 px-1 text-[7px] sm:max-w-[82px] sm:gap-0.5 sm:px-1.5 sm:text-[8px]"
                                : "max-w-[72px] gap-0.5 px-1.5 text-[8px] sm:max-w-[84px]"
                            } ${recentBadgeLabelClass(latestBadge.key)}`}
                          >
                            {latestBadge.key === "hundred-day-streak" && <span aria-hidden="true">👑</span>}
                            <span className="truncate">{latestBadgeLabel}</span>
                          </span>
                        )}
                        <MemberPictogram index={row.pictogramIndex} participantName={row.participant.name} className="!h-9 !w-9 sm:!h-10 sm:!w-10" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-black leading-tight text-oriwan-text sm:text-base">{row.participant.name}</p>
                          <span className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full bg-oriwan-surface-light px-2 py-0.5 text-[10px] font-black leading-none text-oriwan-text shadow-[inset_0_0_0_1px_rgba(16,21,34,0.05)]">
                            <span className="text-[8px] font-extrabold text-oriwan-text-muted">거리</span>
                            <span>{row.distanceKm.toFixed(1)}km</span>
                            <span className="text-[8px] font-extrabold text-oriwan-text-muted">시간</span>
                            <span>{secondsToTime(row.durationSeconds)}</span>
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-oriwan-surface-light">
                          <div
                            className={`gauge-fill-flow h-full rounded-full transition-all duration-[900ms] ease-out ${gaugeColorClass(row.certifiedDays)}`}
                            style={{
                              width: `${motionReady ? Math.max(row.rate, row.certifiedDays ? 3 : 0) : 0}%`,
                              transitionDelay: `${Math.min(index * 45, 500)}ms`,
                            }}
                          />
                        </div>
                      </div>
                      <p className={`shrink-0 text-xl font-black leading-none sm:text-2xl ${gaugeTextClass(row.certifiedDays)}`}>
                        <AnimatedNumber key={`member-rate-${animationRun}-${row.participant.id}`} value={row.rate} suffix="%" />
                      </p>
                    </div>
                  </button>
                  );
                })}
                {!dashboard.participantProgress.length && !loading && (
                  <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-oriwan-text-muted">
                    멤버가 추가되면 인증 현황이 바로 채워집니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-3xl bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
            {error}
          </div>
        )}

        {data?.setup_required && (
          <div className="mt-4 rounded-3xl bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950 ring-1 ring-amber-100">
            아직 운영 데이터가 연결되지 않았어요. Supabase 스키마를 적용하면 멤버들의 러닝 보드가 바로 열립니다.
          </div>
        )}

        <section className="mt-4 grid items-start gap-2 sm:grid-cols-2" aria-label="리커버리 콘텐츠">
          <div className={`grid min-w-0 gap-2 ${showRecoveryVideos ? "sm:col-span-2" : ""}`}>
            <button
              type="button"
              onClick={() => setShowRecoveryVideos((current) => !current)}
              aria-expanded={showRecoveryVideos}
              aria-controls="dashboard-recovery-videos"
              className="card mobile-page-card flex min-h-20 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:ring-lime-300 sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"><IconVideo size={19} /></span>
                <span className="min-w-0">
                  <span id="dashboard-recovery-videos-label" className="block text-sm font-black text-oriwan-text">리커버리 영상</span>
                  <span className="mt-0.5 block truncate text-[10px] font-bold text-oriwan-text-muted">회복·스트레칭 영상 모아보기</span>
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-black text-lime-700">
                {showRecoveryVideos ? "접기" : "펼치기"}
                <IconArrowRight size={14} className={`transition-transform ${showRecoveryVideos ? "rotate-90" : ""}`} />
              </span>
            </button>

            {showRecoveryVideos && (
              <div id="dashboard-recovery-videos" role="region" aria-labelledby="dashboard-recovery-videos-label">
                <LazyYoutubeShortsSection initialDayKey={todayIso} />
              </div>
            )}
          </div>

          <div className={`grid min-w-0 gap-2 ${showRecoveryTrend ? "sm:col-span-2" : ""}`}>
            <button
              type="button"
              onClick={() => setShowRecoveryTrend((current) => !current)}
              aria-expanded={showRecoveryTrend}
              aria-controls="dashboard-recovery-trend"
              className="card mobile-page-card flex min-h-20 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:ring-lime-300 sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600"><IconHeart size={19} /></span>
                <span className="min-w-0">
                  <span id="dashboard-recovery-trend-label" className="block text-sm font-black text-oriwan-text">리커버리 추이</span>
                  <span className="mt-0.5 block truncate text-[10px] font-bold text-oriwan-text-muted">일자별 흐름과 회복 신호 보기</span>
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-black text-lime-700">
                {showRecoveryTrend ? "접기" : "펼치기"}
                <IconArrowRight size={14} className={`transition-transform ${showRecoveryTrend ? "rotate-90" : ""}`} />
              </span>
            </button>

            {showRecoveryTrend && (
              <section id="dashboard-recovery-trend" role="region" aria-labelledby="dashboard-recovery-trend-label" className="card mobile-page-card overflow-hidden bg-oriwan-surface-light p-3 sm:p-5">
                <LazyRecoveryDashboardDetails data={dashboard.recoveryDailyTrend} metrics={dashboard.recoverySignalMetrics} />
              </section>
            )}
          </div>
        </section>

        <p className="py-6 text-center text-[11px] font-semibold text-oriwan-text-muted">
          {loading ? "오늘의 기록을 데려오는 중..." : `마지막 업데이트 ${formatLastUpdated(data?.generated_at)}`}
        </p>

        {showNextSeasonNotice && (
          <NextSeasonNoticeModal
            onClose={closeNextSeasonNotice}
            onCloseToday={dismissNextSeasonNoticeToday}
          />
        )}

        {showOnePlusOneEventModal && onePlusOneEvent && (
          <OnePlusOneEventModal
            event={onePlusOneEvent}
            onClose={() => setShowOnePlusOneEventModal(false)}
            onCloseToday={() => {
              writeDismissedOnePlusOneEvent(onePlusOneEvent.milestoneDay, todayIso);
              setShowOnePlusOneEventModal(false);
            }}
          />
        )}

        {showJourneyReportModal && showJourneyReportLabel && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => setShowJourneyReportModal(false)}
            role="dialog"
            aria-modal="true"
            aria-label="50일간의 여정"
          >
            <div className="card mobile-sheet modal-rise w-full max-w-4xl overflow-y-auto p-4 sm:max-h-[88vh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-lime-300 px-3 py-1 text-[11px] font-black text-slate-950">
                      오늘만 공개
                    </span>
                    <span className="inline-flex rounded-full bg-oriwan-surface-light px-3 py-1 text-[11px] font-black text-oriwan-text-muted">
                      {shortDate(journeyReport.from)}-{shortDate(journeyReport.to)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-black leading-tight text-oriwan-text sm:text-3xl">
                    50일간의 여정
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-oriwan-text-muted">
                    첫 50일 동안 스내사 크루가 함께 쌓은 인증 흐름, 거리, 시간을 한 번에 모았습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowJourneyReportModal(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  ["팀 인증률", `${journeyReport.teamRate}%`],
                  ["누적 거리", `${formatCompactNumber(journeyReport.totalDistanceKm, 1)}km`],
                  ["누적 시간", formatTeamDuration(journeyReport.totalDurationSeconds)],
                  ["50일 완주", `${journeyReport.perfectMemberCount}명`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
                    <p className="text-[11px] font-black text-white/50">{label}</p>
                    <p className="mt-1 truncate text-xl font-black leading-tight text-lime-200">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
                <section className="rounded-[26px] bg-oriwan-surface-light p-4 ring-1 ring-slate-950/5">
                  <div className="mb-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-oriwan-text">오늘의 1등</p>
                      <p className="mt-0.5 text-[11px] font-bold text-oriwan-text-muted">50일 리포트 기준 분야별 리더입니다.</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-lime-200">
                      {journeyReport.leaderCards.length}개 분야
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {journeyReport.leaderCards.map((leader) => (
                      <div key={leader.label} className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-950/5">
                        <p className="text-[10px] font-black text-oriwan-text-muted">{leader.label}</p>
                        <div className="mt-1 flex items-start justify-between gap-2">
                          <p className="min-w-0 break-keep text-base font-black leading-snug text-oriwan-text">{leader.name}</p>
                          <p className="shrink-0 text-sm font-black text-lime-700">{leader.value}</p>
                        </div>
                        <p className="mt-1 break-keep text-[10px] font-bold leading-4 text-oriwan-text-muted">{leader.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[26px] bg-rose-50 p-4 ring-1 ring-rose-100">
                  <div className="mb-3">
                    <p className="text-sm font-black text-rose-950">더 끌어올릴 멤버</p>
                    <p className="mt-0.5 text-[11px] font-bold text-rose-700/70">50일 인증률 기준으로 한 명만 보여줍니다.</p>
                  </div>
                  <div className="grid gap-2">
                    {journeyReport.effortCards.map((member, index) => (
                      <div key={member.name} className="rounded-2xl bg-white px-3 py-2.5 ring-1 ring-rose-100">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-black text-oriwan-text">{index + 1}. {member.name}</p>
                          <p className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">{member.value}</p>
                        </div>
                        <p className="mt-1 text-[10px] font-bold leading-4 text-oriwan-text-muted">{member.detail}</p>
                      </div>
                    ))}
                    {!journeyReport.effortCards.length && (
                      <p className="rounded-2xl bg-white px-3 py-4 text-center text-xs font-bold text-oriwan-text-muted ring-1 ring-rose-100">
                        모두 50일 인증을 채웠습니다.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <div className="mt-3">
                <section className="rounded-[26px] bg-white p-4 ring-1 ring-slate-950/5">
                  <div className="mb-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-oriwan-text">러닝 지역 분포</p>
                      <p className="mt-0.5 text-[11px] font-bold text-oriwan-text-muted">
                        OCR에서 서울 성수, 남양주처럼 확인되는 지역만 분류하고, 불명확한 기록은 기타로 둡니다.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {journeyReport.spaceGroups.map((space) => (
                      <div key={space.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-oriwan-surface-light px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-oriwan-text">{space.label}</p>
                          <p className="mt-0.5 text-[10px] font-bold text-oriwan-text-muted">{space.participantCount}명 · {formatCompactNumber(space.distanceKm, 1)}km</p>
                        </div>
                        <p className="shrink-0 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-lime-200">{space.count}회</p>
                      </div>
                    ))}
                    {!journeyReport.spaceGroups.length && (
                      <p className="rounded-2xl bg-oriwan-surface-light px-3 py-4 text-center text-xs font-bold text-oriwan-text-muted">
                        OCR에서 확인 가능한 지역 정보가 아직 없습니다.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {selectedParticipant && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedParticipant.participant.name} 러닝 상세`}
            onClick={() => {
              setSelectedParticipantId("");
              setSelectedDailyRecordDate("");
              setShowFinalReportPreviewModal(false);
            }}
          >
            <div className="card mobile-sheet modal-rise w-full max-w-2xl overflow-y-auto p-4 sm:max-h-[88vh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              {selectedParticipant.rate >= 100 && <FanfareBurst />}
              <div className="mb-4">
                <div className="flex items-start justify-between gap-3">
                  <p className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${
                    selectedParticipant.rate >= 100 ? "bg-slate-950 text-lime-200" : "bg-lime-300 text-slate-950"
                  }`}>
                    {selectedParticipant.rate >= 100 ? "100% 완주!" : `${selectedParticipant.rate}%`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedParticipantId("");
                      setSelectedDailyRecordDate("");
                      setShowFinalReportPreviewModal(false);
                    }}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                    aria-label="닫기"
                  >
                    <IconX size={18} />
                  </button>
                </div>
                <div className="mt-2 grid gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <MascotCoachButton
                      pictogramIndex={selectedParticipant.pictogramIndex}
                      participantName={selectedParticipant.participant.name}
                      onNext={() => setMascotCoachMessageIndex((current) => current + 1)}
                    />
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="min-w-0 truncate text-2xl font-black leading-tight text-oriwan-text">{selectedParticipant.participant.name}</h3>
                    </div>
                  </div>
                  <MascotCoachBubble
                    key={`${selectedParticipant.participant.id}-${mascotCoachMessageIndex}`}
                    message={selectedMascotCoachMessage}
                  />
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {dashboard.stampDays.map((day, index) => {
                  const stamped = selectedStampedDates.has(day);
                  const dayRecord = selectedRecordByDate.get(day);
                  const isRecoveryStamp = Boolean(dayRecord && isRecoveryCertificationRecord(dayRecord));
                  const isSelected = selectedDailyRecordDate === day;
                  const month = Number(day.slice(5, 7));
                  const date = Number(day.slice(8, 10));
                  const milestoneDay = certificationDayNumber(day);
                  const isDoubleEventStampDay = STAMP_DOUBLE_EVENT_MILESTONES.has(milestoneDay);
                  const isFinalReportStampDay = milestoneDay === FINAL_REPORT_MILESTONE_DAY;
                  const isFutureStampDay = day > dashboard.currentCertificationDate;
                  const previousDay = dashboard.stampDays[index - 1] || "";
                  const showMonthLabel = index === 0 || previousDay.slice(5, 7) !== day.slice(5, 7);
                  const stampStatusLabel = isFutureStampDay ? "예정일" : dayRecord ? (isRecoveryStamp ? "리커버리 인증" : "본 인증") : "미인증";
                  const doubleEventLabel = isDoubleEventStampDay ? ` · ${milestoneDay}일차 2배 이벤트` : "";
                  const finalReportLabel = isFinalReportStampDay ? " · 100일차 개인별 최종 리포트" : "";
                  const stampDateTextClass = isFutureStampDay ? "text-slate-300" : "text-slate-950";
                  const stampSubTextClass = isFutureStampDay ? "text-slate-400" : "text-slate-700";
                  const stampCellToneClass = isRecoveryStamp
                    ? `stamp-cell-hit bg-sky-50 ${isDoubleEventStampDay ? "border-amber-400" : "border-sky-200"}`
                    : isDoubleEventStampDay
                      ? "border-amber-400 bg-white"
                      : stamped || isFinalReportStampDay
                        ? "stamp-cell-hit border-lime-300 bg-white"
                        : "border-slate-100 bg-white text-slate-300";
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!stamped && !isFinalReportStampDay}
                      onClick={() => {
                        if (isFinalReportStampDay) {
                          setSelectedDailyRecordDate("");
                          setShowFinalReportPreviewModal(true);
                          return;
                        }
                        if (stamped) setSelectedDailyRecordDate(day);
                      }}
                      title={`${day}${doubleEventLabel}${finalReportLabel}`}
                      aria-label={`${day} ${stampStatusLabel}${doubleEventLabel}${finalReportLabel}`}
                      style={{ "--stamp-delay": `${Math.min(index * 8, 360)}ms` } as CSSProperties}
                      className={`stamp-cell relative isolate flex h-12 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border text-[10px] font-black leading-none text-slate-950 transition enabled:hover:-translate-y-0.5 disabled:cursor-default sm:h-14 sm:rounded-2xl ${stampCellToneClass} ${isSelected ? "scale-[1.02] ring-2 ring-slate-950 ring-offset-1 ring-offset-white" : ""}`}
                    >
                      {isDoubleEventStampDay && (
                        <span className="absolute left-1 top-1 z-10 rounded-full bg-amber-300 px-1.5 py-[1px] text-[7px] font-black leading-none text-slate-950 shadow-sm ring-1 ring-amber-400/70">
                          1+1
                        </span>
                      )}
                      {showMonthLabel && (
                        <span className="stamp-month-label absolute left-1 top-1 z-10 rounded-full bg-lime-200 px-1.5 py-[1px] text-[7px] font-black leading-none text-slate-950 shadow-sm ring-1 ring-lime-300/70">
                          {month}월
                        </span>
                      )}
                      {isFinalReportStampDay ? (
                        <>
                          <span className="absolute left-1 top-1 z-10 rounded-full bg-lime-300 px-1.5 py-[1px] text-[7px] font-black leading-none text-slate-950 shadow-sm">
                            FINAL
                          </span>
                          <span className={`relative z-10 text-xs font-black leading-none sm:text-sm ${stampDateTextClass}`}>100</span>
                          <span className={`relative z-10 mt-0.5 text-[8px] font-black leading-none sm:text-[9px] ${stampSubTextClass}`}>리포트</span>
                        </>
                      ) : (
                        <span className={`relative z-10 text-xs font-black leading-none sm:text-sm ${stampDateTextClass}`}>{date}</span>
                      )}
                      {dayRecord && !isFinalReportStampDay && (
                        <span className="relative z-10 mt-0.5 text-[9px] font-black leading-none text-slate-950 sm:text-[10px]">
                          {isRecoveryStamp ? "회복" : "✓"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-[22px] bg-oriwan-surface-light p-3 ring-1 ring-slate-950/5 sm:rounded-[24px] sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-oriwan-text">개인 성장 뱃지</p>
                    <p className="mt-0.5 text-[11px] font-bold text-oriwan-text-muted">오전 러닝과 꾸준한 인증을 기준으로 열려요.</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${
                    unlockedSelectedBadgeCount
                      ? "bg-slate-950 text-lime-200 shadow-sm shadow-lime-300/20"
                      : "bg-white text-oriwan-text-muted"
                  }`}>
                    {unlockedSelectedBadgeCount
                      ? `${unlockedSelectedBadgeCount}개 달성`
                      : `0/${selectedPersonalGrowthBadges.length}`}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedPersonalGrowthBadges.map((badge) => (
                    <div
                      key={badge.key}
                      className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border-2 px-3 py-2.5 transition ${badgeCardSurfaceClass(badge)}`}
                    >
                      {badge.unlocked && <FanfareBurst compact />}
                      <span className={`relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${badgeIconSurfaceClass(badge)}`}>
                        <GrowthBadgeIcon icon={badge.icon} />
                      </span>
                      <span className="relative z-10 min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="block truncate text-xs font-black">{badge.label}</span>
                          {badge.unlocked && (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black leading-none ${
                              badge.key === "hundred-day-streak" ? "bg-sky-300 text-blue-950" : "bg-lime-300 text-slate-950"
                            }`}>
                              달성!
                            </span>
                          )}
                        </span>
                        <span className={`mt-0.5 block truncate text-[10px] font-bold ${
                          badge.unlocked ? "text-white/70" : "opacity-70"
                        }`}>{badge.description}</span>
                      </span>
                      <span className={`relative z-10 shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${badgeStatusClass(badge)}`}>
                        {badge.unlocked ? "획득 완료" : badge.progress}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedDailyRecord && selectedParticipant && (
          <div
            className="fixed inset-0 z-[90] flex items-end bg-slate-950/55 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => setSelectedDailyRecordDate("")}
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedParticipant.participant.name} ${selectedDailyRecordDate} 러닝 기록`}
          >
            <div className="card mobile-sheet modal-rise w-full max-w-md overflow-y-auto p-4 sm:max-h-[86vh] sm:p-5" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-lime-200">
                      러닝 기록
                    </span>
                    <span className="inline-flex rounded-full bg-oriwan-surface-light px-3 py-1 text-[11px] font-black text-oriwan-text-muted">
                      {isRecoveryCertificationRecord(selectedDailyRecord) ? "리커버리" : selectedDailyRecord.status === "certified" ? "본 인증" : "확인 중"}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-black leading-tight text-oriwan-text">
                    {selectedDailyRecordDate}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-oriwan-text-muted">
                    {selectedParticipant.participant.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDailyRecordDate("")}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>

              {isRecoveryCertificationRecord(selectedDailyRecord) && (
                <p className="mb-3 rounded-2xl bg-sky-50 px-3 py-2 text-[11px] font-bold leading-5 text-sky-700">
                  회복으로 이어간 날이에요. 총 인증률과 누적 거리, 누적 시간에는 포함되고 성장 뱃지는 본 인증 기준으로 열립니다.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-oriwan-surface-light px-4 py-3 ring-1 ring-slate-950/5">
                  <p className="text-[10px] font-black text-oriwan-text-muted">거리</p>
                  <p className="mt-1 text-2xl font-black leading-tight text-oriwan-text">
                    {selectedDailyRecord.distance_km ? `${selectedDailyRecord.distance_km.toFixed(2)}km` : "-"}
                  </p>
                </div>
                <div className="rounded-2xl bg-oriwan-surface-light px-4 py-3 ring-1 ring-slate-950/5">
                  <p className="text-[10px] font-black text-oriwan-text-muted">시간</p>
                  <p className="mt-1 text-2xl font-black leading-tight text-oriwan-text">
                    {secondsToTime(selectedDailyRecord.duration_seconds)}
                  </p>
                </div>
              </div>

              <div className="mt-2 rounded-2xl bg-white px-4 py-3 shadow-sm shadow-slate-950/5">
                <p className="text-[10px] font-black text-oriwan-text-muted">러닝 공간</p>
                <p className="mt-1 text-sm font-black leading-5 text-oriwan-text">
                  {selectedDailyRecord.space_label || "기타"}
                </p>
              </div>
            </div>
          </div>
        )}

        {showFinalReportPreviewModal && selectedParticipant && (
          <div
            className="fixed inset-0 z-[90] flex items-end bg-slate-950/55 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => setShowFinalReportPreviewModal(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedParticipant.participant.name} 개인별 최종 리포트 안내`}
          >
            <div className="card mobile-sheet modal-rise w-full max-w-xl overflow-y-auto p-4 sm:max-h-[86vh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-lime-200">
                    100일차 최종 리포트
                  </p>
                  <h3 className="mt-3 text-2xl font-black leading-tight text-oriwan-text">
                    {remainingSeasonDays > 0
                      ? `${selectedParticipant.participant.name}님의 개인별 최종 리포트가 열릴 예정이에요`
                      : `${selectedParticipant.participant.name}님의 100일 리포트가 완성됐어요`}
                  </h3>
                  <p className="mt-2 text-sm font-bold leading-6 text-oriwan-text-muted">
                    {remainingSeasonDays > 0
                      ? "시즌이 끝나면 인증률, 누적 거리와 시간, 연속 인증, 리커버리 활용, 획득 뱃지를 한 장의 개인 리포트로 보여줄 수 있어요."
                      : "인증한 날짜와 주간·월간 흐름, 획득 뱃지를 한 장의 포스터로 보고 저장할 수 있어요."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFinalReportPreviewModal(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  ["현재 인증률", `${selectedParticipant.rate}%`],
                  ["남은 인증", `${selectedRemainingDays}일`],
                  ["누적 거리", `${formatCompactNumber(selectedParticipant.distanceKm, 1)}km`],
                  ["누적 시간", formatTeamDuration(selectedParticipant.durationSeconds)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-oriwan-surface-light px-4 py-3 ring-1 ring-slate-950/5">
                    <p className="text-[10px] font-black text-oriwan-text-muted">{label}</p>
                    <p className="mt-1 truncate text-xl font-black leading-tight text-oriwan-text">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2">
                {[
                  ["인증 하이라이트", `${selectedParticipant.certifiedDays}/${CHALLENGE_DAYS}일 인증, 최장 ${selectedParticipant.longestStreak}일 연속 인증`],
                  ["러닝 누적", `${formatCompactNumber(selectedParticipant.distanceKm, 1)}km · ${formatTeamDuration(selectedParticipant.durationSeconds)}`],
                  ["회복 활용", selectedParticipant.recoveryUsageCount > 0 ? `리커버리 ${selectedParticipant.recoveryUsageCount}일 활용` : "리커버리 없이 본 인증 중심으로 진행"],
                  ["성장 뱃지", unlockedSelectedBadgeCount > 0 ? `${unlockedSelectedBadgeCount}개 달성 뱃지 정리` : "시즌 종료 시점의 뱃지 현황 정리"],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-2xl bg-white px-4 py-3 shadow-sm shadow-slate-950/5">
                    <p className="text-sm font-black text-oriwan-text">{title}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-oriwan-text-muted">{description}</p>
                  </div>
                ))}
              </div>

              {remainingSeasonDays === 0 && (
                <Link
                  href={`/dashboard/report/${selectedParticipant.participant.id}`}
                  className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-lime-200 shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5"
                >
                  {selectedParticipant.participant.name}님의 포스터 보기
                </Link>
              )}
            </div>
          </div>
        )}

        {showSeasonReportModal && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            role="dialog"
            aria-modal="true"
            aria-label="시즌 리포트 안내"
            onClick={() => setShowSeasonReportModal(false)}
          >
            <div className="card mobile-sheet modal-rise w-full max-w-2xl overflow-y-auto p-4 sm:max-h-[88vh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex rounded-full bg-lime-300 px-3 py-1 text-[11px] font-black text-slate-950">
                    시즌 리포트
                  </p>
                  <h3 className="mt-2 text-2xl font-black leading-tight text-oriwan-text">
                    {remainingSeasonDays > 0
                      ? `${remainingSeasonDays}일 후에 시즌 종료 리포트가 공개됩니다!`
                      : "시즌 종료 리포트가 공개됐어요!"}
                  </h3>
                  <p className="mt-2 text-sm font-bold leading-6 text-oriwan-text-muted">
                    현재 진행일은 {dashboard.elapsedDays.length}/{CHALLENGE_DAYS}입니다. 시즌이 끝나면 각자의 오전 러닝 여정을 한눈에 볼 수 있어요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSeasonReportModal(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["총 인증일", "시즌 동안 인증한 날짜 수를 정리해요."],
                  ["총 거리", "누적 러닝 거리와 대표 구간을 보여줘요."],
                  ["총 시간", "함께 쌓은 러닝 시간을 보기 쉽게 합산해요."],
                  ["최장 연속 인증", "가장 오래 이어간 오전 루틴을 기록해요."],
                  ["받은 뱃지", "모닝 스타터, 7일 루틴 같은 성장 뱃지를 모아 보여줘요."],
                  ["나의 러닝 타입", "꾸준한 페이서, 복귀형 러너처럼 시즌 성향을 요약해요."],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-2xl bg-oriwan-surface-light px-4 py-3 ring-1 ring-slate-950/5">
                    <p className="text-sm font-black text-oriwan-text">{title}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-oriwan-text-muted">{description}</p>
                  </div>
                ))}
              </div>
              {remainingSeasonDays === 0 && (
                <Link
                  href="/dashboard/report"
                  className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-lime-200 shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5"
                >
                  100일 시즌 리포트 보기
                </Link>
              )}
            </div>
          </div>
        )}

        {trendModal && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            role="dialog"
            aria-modal="true"
            aria-label={trendModal === "weekly" ? "주차별 인증 흐름" : "매일 인증 흐름"}
            onClick={() => setTrendModal(null)}
          >
            <div className="card mobile-sheet w-full max-w-5xl overflow-y-auto p-4 sm:max-h-[88vh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-lime-200">
                    {trendModal === "weekly" ? "주차별 인증률" : "매일 인증률"}
                  </p>
                  <h3 className="mt-2 text-2xl font-black leading-tight text-oriwan-text">
                    {trendModal === "weekly" ? "주차별 인증 흐름" : "매일 인증 흐름"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setTrendModal(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>
              <div className="rounded-[28px] bg-slate-950 p-4 text-white">
                <svg viewBox={`0 0 ${trendGraph.width} ${trendGraph.height}`} className="h-[280px] w-full overflow-visible">
                  <line x1={trendGraph.padding} y1={trendGraph.height - trendGraph.padding} x2={trendGraph.width - trendGraph.padding} y2={trendGraph.height - trendGraph.padding} stroke="rgba(255,255,255,.16)" strokeWidth="2" className="dashboard-axis-draw" />
                  <line x1={trendGraph.padding} y1={trendGraph.padding} x2={trendGraph.padding} y2={trendGraph.height - trendGraph.padding} stroke="rgba(255,255,255,.12)" strokeWidth="2" className="dashboard-axis-draw" />
                  {[25, 50, 75].map((guide) => {
                    const y = trendGraph.height - trendGraph.padding - (guide / 100) * (trendGraph.height - trendGraph.padding * 2);
                    return (
                      <line
                        key={`guide-${guide}`}
                        x1={trendGraph.padding}
                        y1={y}
                        x2={trendGraph.width - trendGraph.padding}
                        y2={y}
                        stroke="rgba(255,255,255,.08)"
                        strokeWidth="1"
                        strokeDasharray="5 8"
                        className="dashboard-axis-draw"
                      />
                    );
                  })}
                  <path key={`${trendModal}-area`} d={trendGraph.areaPath} fill="url(#trend-area-gradient)" className="dashboard-area-rise" />
                  <defs>
                    <linearGradient id="trend-area-gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#bef264" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#bef264" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path key={trendModal} d={trendGraph.path} fill="none" stroke="#bef264" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="dashboard-line-draw" />
                  {trendGraph.points.map((point, index) => (
                    <g key={`${trendModal}-${index}`} className="dashboard-dot-pop" style={{ animationDelay: `${Math.min(index * 70, 700)}ms` }}>
                      <circle cx={point.x} cy={point.y} r="5" fill="#bef264" />
                      <circle cx={point.x} cy={point.y} r="10" fill="#bef264" opacity=".16" className="dashboard-dot-halo" />
                      <text x={point.x} y={Math.max(14, point.y - 10)} textAnchor="middle" className="dashboard-chart-label fill-white text-[10px] font-black">{trendItems[index]?.value || 0}%</text>
                    </g>
                  ))}
                </svg>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {trendItems.map((item) => (
                    <span key={`${item.label}-${item.caption}`} className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-white/70">
                      {item.caption || `${item.label} · ${item.value}%`}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
