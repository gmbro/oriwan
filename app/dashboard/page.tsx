"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCalendar, IconDna, IconDroplet, IconFlame, IconHeart, IconMountain, IconMuscle, IconRun, IconSprout, IconSync, IconTarget, IconX } from "@/components/icons";
import { buildMemberPictogramMap, MemberPictogram } from "@/components/member-pictogram";
import { YoutubeShortsSection } from "@/components/youtube-shorts-section";
import { ACTUAL_CERTIFICATION_START_DATE, CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_DAYS } from "@/lib/challenge";
import { DASHBOARD_REFRESH_CHANNEL, DASHBOARD_REFRESH_EVENT } from "@/lib/dashboard-refresh";
import { addDays, isCertificationCountedStatus, secondsToTime, toIsoDate, toKstIsoDate } from "@/lib/run-records";
import { createClient } from "@/lib/supabase/client";

type Participant = {
  id: string;
  name: string;
  nickname: string | null;
};

type RunRecord = {
  id: string;
  participant_id: string | null;
  record_date: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  status: "certified" | "needs_review" | "missing" | "rejected";
};

type PublicDashboardData = {
  from: string;
  to: string;
  certification_display_start_date?: string;
  challenge_start_date?: string;
  challenge_end_date?: string;
  generated_at: string;
  participants: Participant[];
  records: RunRecord[];
  setup_required?: boolean;
  error?: string;
};

type TrendModal = "weekly" | "daily" | null;
type PersonalGrowthBadge = {
  key: string;
  label: string;
  description: string;
  progress: string;
  unlocked: boolean;
  icon: "run" | "flame" | "target" | "calendar" | "sprout" | "heart" | "mountain" | "muscle" | "droplet" | "sync" | "dna";
  colorClassName: string;
};

const actualCertificationEndDate = toIsoDate(addDays(new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`), CHALLENGE_DAYS - 1));

function formatLastUpdated(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function certificationDayLabel(referenceDate: string) {
  const start = new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`);
  const current = new Date(`${referenceDate}T00:00:00`);
  const diffDays = Math.floor((current.getTime() - start.getTime()) / 86_400_000);
  if (diffDays < 0) return `D-${CHALLENGE_DAYS}`;
  return `D-${Math.max(CHALLENGE_DAYS - diffDays, 0)}`;
}

function shortDate(value: string) {
  return value.slice(5).replace("-", ".");
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
const TOP_RUNNER_BADGE_EXCLUDED_NAMES = new Set(["이경민"]);
const PUBLIC_DASHBOARD_STORAGE_KEY = "oriwan-public-dashboard-cache-v1";
const PUBLIC_DASHBOARD_STORAGE_TTL_MS = 5 * 60 * 1000;
const PUBLIC_DASHBOARD_FOCUS_REFRESH_MS = 30 * 1000;

function readCachedDashboardData() {
  if (typeof window === "undefined") return null;

  try {
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
    window.localStorage.setItem(PUBLIC_DASHBOARD_STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      data,
    }));
  } catch {
    // Storage can fail in private mode. Network refresh still keeps the dashboard usable.
  }
}

function normalizeParticipantName(name: string) {
  return name.normalize("NFKC").replace(/[\s\u200B-\u200D\uFEFF]/g, "");
}

function canShowTopRunnerBadge(participant: Participant, topRunnerId: string) {
  return topRunnerId === participant.id && !TOP_RUNNER_BADGE_EXCLUDED_NAMES.has(normalizeParticipantName(participant.name));
}

function getLongestDateStreak(dates: string[]) {
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

function getCurrentDateStreak(dates: string[], referenceDate: string) {
  const dateSet = new Set(dates);
  let streak = 0;
  let cursor = referenceDate;
  while (dateSet.has(cursor)) {
    streak += 1;
    cursor = toIsoDate(addDays(new Date(`${cursor}T00:00:00`), -1));
  }
  return streak;
}

function getWeekdayMorningProgress(dates: string[], referenceDate: string) {
  const dateSet = new Set(dates);
  const reference = new Date(`${referenceDate}T00:00:00`);
  const day = reference.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDays(reference, mondayOffset);
  const weekdays = Array.from({ length: 5 }, (_, index) => toIsoDate(addDays(monday, index)));
  return weekdays.filter((weekday) => dateSet.has(weekday)).length;
}

function GrowthBadgeIcon({ icon }: { icon: PersonalGrowthBadge["icon"] }) {
  const iconClassName = "h-4 w-4";
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

function badgeProgress(current: number, target: number, suffix = "") {
  return `${Math.min(Math.floor(current), target)}${suffix}/${target}${suffix}`;
}

function makePersonalGrowthBadges({
  certifiedDays,
  certifiedDates,
  currentStreak,
  longestStreak,
  weekdayMorningCount,
  elapsedDayCount,
  distanceKm,
  durationSeconds,
  maxSingleDistanceKm,
}: {
  certifiedDays: number;
  certifiedDates: string[];
  currentStreak: number;
  longestStreak: number;
  weekdayMorningCount: number;
  elapsedDayCount: number;
  distanceKm: number;
  durationSeconds: number;
  maxSingleDistanceKm: number;
}): PersonalGrowthBadge[] {
  const durationHours = durationSeconds / 3600;
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
      description: "현재 3일 연속 인증",
      progress: `${Math.min(currentStreak, 3)}/3`,
      unlocked: currentStreak >= 3,
      icon: "flame",
      colorClassName: "bg-orange-300 text-slate-950",
    },
    {
      key: "seven-day-routine",
      label: "7일 루틴",
      description: "7일 연속 인증",
      progress: `${Math.min(longestStreak, 7)}/7`,
      unlocked: longestStreak >= 7,
      icon: "target",
      colorClassName: "bg-sky-300 text-slate-950",
    },
    {
      key: "weekday-morning",
      label: "평일 모닝 5",
      description: "이번 주 평일 오전 루틴",
      progress: `${Math.min(weekdayMorningCount, 5)}/5`,
      unlocked: weekdayMorningCount >= 5,
      icon: "calendar",
      colorClassName: "bg-amber-300 text-slate-950",
    },
    {
      key: "season-pacer",
      label: "시즌 페이서",
      description: "오늘까지 빠짐없이 인증",
      progress: `${certifiedDates.length}/${Math.max(elapsedDayCount, 1)}`,
      unlocked: elapsedDayCount > 0 && certifiedDays >= elapsedDayCount,
      icon: "heart",
      colorClassName: "bg-rose-300 text-slate-950",
    },
    {
      key: "thirty-day-root",
      label: "30일 뿌리",
      description: "30일 연속 인증",
      progress: badgeProgress(longestStreak, 30),
      unlocked: longestStreak >= 30,
      icon: "dna",
      colorClassName: "bg-teal-300 text-slate-950",
    },
    {
      key: "fifty-day-core",
      label: "50일 코어",
      description: "50일 연속 인증",
      progress: badgeProgress(longestStreak, 50),
      unlocked: longestStreak >= 50,
      icon: "muscle",
      colorClassName: "bg-violet-300 text-slate-950",
    },
    {
      key: "seventy-day-arc",
      label: "70일 아치",
      description: "70일 연속 인증",
      progress: badgeProgress(longestStreak, 70),
      unlocked: longestStreak >= 70,
      icon: "mountain",
      colorClassName: "bg-indigo-300 text-slate-950",
    },
    {
      key: "five-k-finisher",
      label: "5K 완주",
      description: "하루 5km 이상 러닝",
      progress: badgeProgress(maxSingleDistanceKm, 5, "km"),
      unlocked: maxSingleDistanceKm >= 5,
      icon: "sprout",
      colorClassName: "bg-green-300 text-slate-950",
    },
    {
      key: "ten-k-finisher",
      label: "10K 완주",
      description: "하루 10km 이상 러닝",
      progress: badgeProgress(maxSingleDistanceKm, 10, "km"),
      unlocked: maxSingleDistanceKm >= 10,
      icon: "mountain",
      colorClassName: "bg-emerald-300 text-slate-950",
    },
    {
      key: "distance-fifty",
      label: "거리 50K",
      description: "누적 50km 달성",
      progress: badgeProgress(distanceKm, 50, "km"),
      unlocked: distanceKm >= 50,
      icon: "run",
      colorClassName: "bg-cyan-300 text-slate-950",
    },
    {
      key: "distance-hundred",
      label: "거리 100K",
      description: "누적 100km 달성",
      progress: badgeProgress(distanceKm, 100, "km"),
      unlocked: distanceKm >= 100,
      icon: "target",
      colorClassName: "bg-fuchsia-300 text-slate-950",
    },
    {
      key: "time-ten-hours",
      label: "시간 10H",
      description: "누적 러닝 10시간",
      progress: badgeProgress(durationHours, 10, "h"),
      unlocked: durationHours >= 10,
      icon: "droplet",
      colorClassName: "bg-blue-300 text-slate-950",
    },
    {
      key: "time-twenty-hours",
      label: "시간 20H",
      description: "누적 러닝 20시간",
      progress: badgeProgress(durationHours, 20, "h"),
      unlocked: durationHours >= 20,
      icon: "sync",
      colorClassName: "bg-lime-400 text-slate-950",
    },
  ];
}

function makeGraphPath(items: { value: number }[], width = 320, height = 150, padding = 24) {
  if (!items.length) return { path: "", points: [] as { x: number; y: number }[], width, height, padding };

  const points = items.map((item, index) => {
    const x = items.length === 1 ? width / 2 : padding + (index / (items.length - 1)) * (width - padding * 2);
    const y = height - padding - (Math.max(0, Math.min(item.value, 100)) / 100) * (height - padding * 2);
    return { x, y };
  });
  const path = points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  return { path, points, width, height, padding };
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

  return <span className={className}>{displayValue}{suffix}</span>;
}

function AnimatedMetricNumber({
  value,
  suffix = "",
  decimals = 1,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
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
    const duration = 850;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [value]);

  return <>{displayValue.toFixed(decimals)}{suffix}</>;
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

export default function DashboardPage() {
  const [data, setData] = useState<PublicDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [todayIso, setTodayIso] = useState(() => toKstIsoDate());
  const [motionReady, setMotionReady] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [selectedDailyRecordDate, setSelectedDailyRecordDate] = useState("");
  const [trendModal, setTrendModal] = useState<TrendModal>(null);
  const [showSeasonReportModal, setShowSeasonReportModal] = useState(false);
  const loadingRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
  const lastLoadedAtRef = useRef(0);

  const load = useCallback(async (options?: { fresh?: boolean }) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setTodayIso(toKstIsoDate());
      const cacheBuster = options?.fresh ? `&t=${Date.now()}` : "";
      const response = await fetch(`/api/public-dashboard?scope=all${cacheBuster}`, {
        cache: options?.fresh ? "no-store" : "default",
      });
      const json = await response.json() as PublicDashboardData;
      if (!response.ok) throw new Error(json.error || "오늘의 보드를 불러오지 못했어요.");
      setData(json);
      writeCachedDashboardData(json);
      lastLoadedAtRef.current = Date.now();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "대시보드를 불러오지 못했어요.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      if (document.visibilityState === "visible") load({ fresh: true });
    }, 650);
  }, [load]);

  useEffect(() => {
    queueMicrotask(() => {
      const cachedData = readCachedDashboardData();
      if (cachedData) {
        setData(cachedData);
        setError("");
        setLoading(false);
        lastLoadedAtRef.current = Date.now();
      }
      void load();
    });
    const supabase = createClient();
    const channel = supabase
      .channel(DASHBOARD_REFRESH_CHANNEL)
      .on("broadcast", { event: DASHBOARD_REFRESH_EVENT }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_run_records" }, scheduleRefresh)
      .subscribe();

    const shouldRefresh = (minimumAgeMs = PUBLIC_DASHBOARD_FOCUS_REFRESH_MS) => (
      Date.now() - lastLoadedAtRef.current > minimumAgeMs
    );

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && shouldRefresh(45_000)) load();
    }, 60000);
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
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, scheduleRefresh]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => setMotionReady(true));
    if (reduceMotion) return () => cancelAnimationFrame(frame);
    return () => cancelAnimationFrame(frame);
  }, []);

  const dashboard = useMemo(() => {
    const participants = data?.participants || [];
    const records = data?.records || [];
    const effectiveToday = todayIso > actualCertificationEndDate ? actualCertificationEndDate : todayIso;
    const certifiedRecords = records.filter((record) => isCertificationCountedStatus(record.status));
    const officialCertifiedRecords = certifiedRecords.filter(
      (record) => Boolean(record.record_date && record.record_date >= ACTUAL_CERTIFICATION_START_DATE && record.record_date <= actualCertificationEndDate)
    );
    const currentCertificationDate = effectiveToday;
    const currentDateRecords = officialCertifiedRecords.filter((record) => record.record_date === currentCertificationDate);
    const currentDateCertifiedIds = new Set(
      currentDateRecords
        .filter((record) => record.participant_id)
        .map((record) => record.participant_id)
    );

    const completionRate = participants.length ? Math.round((currentDateCertifiedIds.size / participants.length) * 100) : 0;

    const certifiedIdsByDay = new Map<string, Set<string>>();
    const certifiedDaysByParticipant = new Map<string, Set<string>>();
    const officialMetricsByParticipant = new Map<string, { distanceKm: number; durationSeconds: number; maxSingleDistanceKm: number }>();

    officialCertifiedRecords.forEach((record) => {
      if (!record.participant_id || !record.record_date) return;
      if (!certifiedIdsByDay.has(record.record_date)) certifiedIdsByDay.set(record.record_date, new Set());
      certifiedIdsByDay.get(record.record_date)?.add(record.participant_id);

      if (!certifiedDaysByParticipant.has(record.participant_id)) certifiedDaysByParticipant.set(record.participant_id, new Set());
      certifiedDaysByParticipant.get(record.participant_id)?.add(record.record_date);

      const metrics = officialMetricsByParticipant.get(record.participant_id) || { distanceKm: 0, durationSeconds: 0, maxSingleDistanceKm: 0 };
      metrics.distanceKm += record.distance_km || 0;
      metrics.durationSeconds += record.duration_seconds || 0;
      metrics.maxSingleDistanceKm = Math.max(metrics.maxSingleDistanceKm, record.distance_km || 0);
      officialMetricsByParticipant.set(record.participant_id, metrics);
    });

    const stampDatesByParticipant = new Map<string, Set<string>>();
    const stampRecordsByParticipant = new Map<string, Map<string, RunRecord>>();
    const latestStampDate = certifiedRecords.reduce((latest, record) => {
      if (!record.record_date) return latest;
      return record.record_date > latest ? record.record_date : latest;
    }, currentCertificationDate > CERTIFICATION_DISPLAY_START_DATE ? currentCertificationDate : CERTIFICATION_DISPLAY_START_DATE);

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
    const certifiedCountByDay = new Map(dayTrend.map((day) => [day.day, day.certifiedCount]));
    const visibleOfficialWeeks = Array.from({ length: Math.ceil(officialCertificationDays.length / 7) }, (_, index) => {
      const weekDays = officialCertificationDays.slice(index * 7, index * 7 + 7);
      return { index, weekDays };
    }).filter((week) => week.weekDays[0] && week.weekDays[0] <= currentCertificationDate);
    const weekTrend = visibleOfficialWeeks.map(({ index, weekDays }) => {
      const certifiedSlots = weekDays.reduce((sum, day) => sum + (certifiedCountByDay.get(day) || 0), 0);
      const possibleSlots = weekDays.length * participants.length;
      const averageRate = possibleSlots ? Math.round((certifiedSlots / possibleSlots) * 100) : 0;
      return {
        label: `${index + 1}주`,
        from: weekDays[0] || "",
        to: weekDays.at(-1) || "",
        averageRate,
        averageCount: weekDays.length ? Math.round(certifiedSlots / weekDays.length) : 0,
      };
    });
    const pictogramByParticipantId = buildMemberPictogramMap(participants);
    const participantProgress = participants
      .map((participant) => {
        const certifiedDates = Array.from(certifiedDaysByParticipant.get(participant.id) || []).sort();
        const stampedDates = Array.from(stampDatesByParticipant.get(participant.id) || []).sort();
        const stampedRecords = Array.from(stampRecordsByParticipant.get(participant.id)?.values() || [])
          .sort((a, b) => (a.record_date || "").localeCompare(b.record_date || ""));
        const metrics = officialMetricsByParticipant.get(participant.id) || { distanceKm: 0, durationSeconds: 0, maxSingleDistanceKm: 0 };
        const certifiedDays = certifiedDates.length;
        const rate = Math.min(Math.round((certifiedDays / CHALLENGE_DAYS) * 100), 100);
        const currentStreak = getCurrentDateStreak(certifiedDates, currentCertificationDate);
        const longestStreak = getLongestDateStreak(certifiedDates);
        const weekdayMorningCount = getWeekdayMorningProgress(certifiedDates, currentCertificationDate);
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
          rate,
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
      weekTrend,
      participantProgress,
      stampDays: makeDaysThrough(CERTIFICATION_DISPLAY_START_DATE, latestStampDate),
    };
  }, [data, todayIso]);
  const latestWeeklyRate = dashboard.weekTrend.at(-1)?.averageRate || 0;
  const latestDailyRate = dashboard.dayTrend.at(-1)?.rate || 0;
  const selectedParticipant = dashboard.participantProgress.find((row) => row.participant.id === selectedParticipantId) || null;
  const topRunnerId = dashboard.participantProgress.find((row) => (
    row.certifiedDays > 0 || row.distanceKm > 0 || row.durationSeconds > 0
  ))?.participant.id || "";
  const selectedStampedDates = new Set(selectedParticipant?.stampedDates || []);
  const selectedRecordByDate = new Map<string, RunRecord>(
    (selectedParticipant?.stampedRecords || [])
      .filter((record) => Boolean(record.record_date))
      .map((record) => [record.record_date as string, record])
  );
  const selectedDailyRecord = selectedDailyRecordDate ? selectedRecordByDate.get(selectedDailyRecordDate) : null;
  const selectedPersonalGrowthBadges = selectedParticipant ? makePersonalGrowthBadges({
    certifiedDays: selectedParticipant.certifiedDays,
    certifiedDates: selectedParticipant.certifiedDates,
    currentStreak: selectedParticipant.currentStreak,
    longestStreak: selectedParticipant.longestStreak,
    weekdayMorningCount: selectedParticipant.weekdayMorningCount,
    elapsedDayCount: dashboard.elapsedDays.length,
    distanceKm: selectedParticipant.distanceKm,
    durationSeconds: selectedParticipant.durationSeconds,
    maxSingleDistanceKm: selectedParticipant.maxSingleDistanceKm,
  }) : [];
  const unlockedSelectedBadgeCount = selectedPersonalGrowthBadges.filter((badge) => badge.unlocked).length;
  const remainingSeasonDays = Math.max(CHALLENGE_DAYS - dashboard.elapsedDays.length, 0);
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

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-oriwan-bg">
      <header className="sticky top-0 z-50 border-b border-slate-950/10 bg-[#101522]/95 px-3 py-2.5 text-white backdrop-blur-2xl sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/oriwan-logo-v2.png" alt="스내사 러닝보드" width={38} height={38} className="rounded-2xl bg-lime-300" />
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-black leading-none sm:text-[30px]">스내사 러닝보드</h1>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-0 py-0 sm:px-4 sm:py-6">
        <section className="overflow-hidden bg-white sm:rounded-[32px] sm:shadow-2xl sm:shadow-slate-950/10 sm:ring-1 sm:ring-slate-950/5">
          <div className="relative overflow-hidden bg-[#101522] px-3 py-3.5 text-white sm:p-7">
            <div className="relative mx-auto flex max-w-xl flex-col gap-2.5 sm:gap-3">
              <div className="flex max-w-full flex-nowrap justify-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
                <p className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black text-lime-200 ring-1 ring-white/10 sm:text-[11px]">
                  {shortDate(dashboard.currentCertificationDate)}
                </p>
                <p className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-lime-300 px-3 py-1.5 text-[10px] font-black text-slate-950 shadow-sm shadow-lime-300/30 sm:text-[11px]">
                  {certificationDayLabel(dashboard.currentCertificationDate)}
                </p>
              </div>

              <div className="rounded-[22px] bg-white/10 p-3 ring-1 ring-white/10 shadow-2xl shadow-slate-950/20 sm:rounded-[30px] sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-white/45">오늘 인증률</p>
                    <p className="mt-1 text-[2.55rem] font-black leading-none text-lime-200 sm:text-[3.5rem]">
                      {isInitialDashboardLoading ? "--" : <AnimatedNumber value={dashboard.completionRate} suffix="%" />}
                    </p>
                  </div>
                  <svg viewBox="0 0 120 120" className="h-[clamp(4.7rem,22vw,7rem)] w-[clamp(4.7rem,22vw,7rem)] shrink-0 -rotate-90 dashboard-ring-pop">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="14" />
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
                      className="transition-[stroke-dashoffset] duration-1000 ease-out"
                    />
                  </svg>
                </div>
                <p className="mt-2 text-xs font-semibold text-white/50">
                  {isInitialDashboardLoading ? "인증 현황 불러오는 중" : `${dashboard.currentDateCertifiedIds.size}/${dashboard.participants.length}명 인증 완료`}
                </p>
              </div>
            </div>
          </div>

          <div className="p-2.5 sm:p-5">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowSeasonReportModal(true)}
                className="dashboard-card-reveal rounded-2xl bg-white px-1.5 py-2.5 text-center ring-1 ring-slate-950/5 transition hover:-translate-y-0.5 hover:ring-lime-300 sm:rounded-3xl sm:px-3 sm:py-4 [animation-delay:0ms]"
              >
                <p className="text-[10px] font-black text-oriwan-text-muted">진행일</p>
                <p className="mt-1 text-[1.35rem] font-black leading-tight text-oriwan-text sm:text-2xl">
                  <AnimatedNumber value={dashboard.elapsedDays.length} />/{CHALLENGE_DAYS}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTrendModal("weekly")}
                className="dashboard-card-reveal rounded-2xl bg-white px-1.5 py-2.5 text-center ring-1 ring-slate-950/5 transition hover:-translate-y-0.5 hover:ring-lime-300 sm:rounded-3xl sm:px-3 sm:py-4 [animation-delay:90ms]"
              >
                <p className="text-[10px] font-black text-oriwan-text-muted">주차별 인증률</p>
                <p className="mt-1 text-[1.35rem] font-black leading-tight text-oriwan-text sm:text-2xl">
                  {isInitialDashboardLoading ? "--" : <AnimatedNumber value={latestWeeklyRate} suffix="%" />}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTrendModal("daily")}
                className="dashboard-card-reveal rounded-2xl bg-lime-300 px-1.5 py-2.5 text-center text-slate-950 shadow-sm shadow-lime-300/30 transition hover:-translate-y-0.5 hover:ring-2 hover:ring-lime-400 sm:rounded-3xl sm:px-3 sm:py-4 [animation-delay:180ms]"
              >
                <p className="text-[10px] font-black opacity-60">매일 인증률</p>
                <p className="mt-1 text-[1.35rem] font-black leading-tight sm:text-2xl">
                  {isInitialDashboardLoading ? "--" : <AnimatedNumber value={latestDailyRate} suffix="%" />}
                </p>
              </button>
            </div>

            <div className="mt-4 sm:mt-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-base font-black leading-tight text-oriwan-text">스내사 크루별 인증게이지</h4>
                </div>
                <span className="inline-flex shrink-0 rounded-full bg-lime-300 px-3 py-1 text-[11px] font-black text-slate-950 shadow-sm shadow-lime-300/30">
                  {isInitialDashboardLoading ? "멤버 불러오는 중" : `멤버 ${dashboard.participants.length}명`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {isInitialDashboardLoading && Array.from({ length: 6 }, (_, index) => (
                  <div key={`dashboard-loading-${index}`} className="rounded-[16px] bg-white px-2 py-2 ring-1 ring-slate-950/5 sm:rounded-[18px] sm:px-3 sm:py-2.5">
                    <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                      <div className="flex min-w-0 flex-col items-center gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-oriwan-surface-light" />
                        <span className="flex min-w-0 flex-col items-center gap-1 sm:flex-row sm:flex-wrap sm:gap-1.5">
                          <span className="block h-3 w-14 animate-pulse rounded-full bg-oriwan-surface-light sm:w-20" />
                          <span className="hidden h-5 w-16 animate-pulse rounded-full bg-oriwan-surface-light sm:block" />
                          <span className="hidden h-5 w-16 animate-pulse rounded-full bg-oriwan-surface-light sm:block" />
                        </span>
                      </div>
                      <span className="h-5 w-10 shrink-0 animate-pulse rounded-full bg-oriwan-surface-light sm:block" />
                    </div>
                    <div className="mt-2 h-1.5 animate-pulse rounded-full bg-oriwan-surface-light" />
                  </div>
                ))}
                {dashboard.participantProgress.map((row, index) => {
                  const isTopRunner = canShowTopRunnerBadge(row.participant, topRunnerId);
                  return (
                  <button
                    key={row.participant.id}
                    type="button"
                    onClick={() => {
                      setSelectedParticipantId(row.participant.id);
                      setSelectedDailyRecordDate("");
                    }}
                    className={`relative overflow-hidden rounded-[16px] bg-white px-2 py-2 text-center ring-1 ring-slate-950/5 transition hover:-translate-y-0.5 hover:ring-lime-300 sm:rounded-[18px] sm:px-3 sm:py-2.5 sm:text-left ${
                    row.rate >= 100 ? "gauge-complete-card" : "dashboard-gauge-card"
                    }`}
                  >
                    {row.rate >= 100 && <FanfareBurst compact />}
                    {isTopRunner && (
                      <span
                        className="absolute bottom-1.5 right-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/35 ring-2 ring-white sm:bottom-2 sm:right-2 sm:h-7 sm:w-7"
                        title="1등 기준: 인증일 > 총거리 > 총시간"
                        aria-label={`${row.participant.name} 1등 파란 뱃지`}
                      >
                        <svg viewBox="0 0 24 24" className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true">
                          <path
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="M6.5 12.2 10.2 16 17.8 8"
                          />
                        </svg>
                      </span>
                    )}
                    <div className="sm:hidden">
                      <div className="mx-auto mb-1 flex justify-center">
                        <MemberPictogram index={row.pictogramIndex} participantName={row.participant.name} className="!h-6 !w-6" />
                      </div>
                      <p className="truncate text-[12px] font-black leading-tight text-oriwan-text">{row.participant.name}</p>
                      <p className={`mt-0.5 text-lg font-black leading-none ${gaugeTextClass(row.certifiedDays)}`}>
                        <AnimatedNumber value={row.rate} suffix="%" />
                      </p>
                      <div className="mt-1 flex min-w-0 items-center justify-center gap-1 text-[8px] font-black leading-none text-oriwan-text-muted">
                        <span className="truncate">{row.distanceKm.toFixed(1)}km</span>
                        <span className="truncate">{secondsToTime(row.durationSeconds)}</span>
                      </div>
                      <div className={`mt-1.5 h-1.5 overflow-hidden rounded-full bg-oriwan-surface-light ${isTopRunner ? "mr-5" : ""}`}>
                        <div
                          className={`gauge-fill-flow h-full rounded-full transition-all duration-1000 ease-out ${gaugeColorClass(row.certifiedDays)}`}
                          style={{
                            width: `${motionReady ? Math.max(row.rate, row.certifiedDays ? 3 : 0) : 0}%`,
                            transitionDelay: `${Math.min(index * 45, 500)}ms`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="hidden items-center justify-between gap-2 sm:flex">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <MemberPictogram index={row.pictogramIndex} participantName={row.participant.name} />
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <p className="truncate text-base font-black leading-tight text-oriwan-text">{row.participant.name}</p>
                          <span className="inline-flex items-baseline gap-1 rounded-full bg-oriwan-surface-light px-2 py-0.5 text-[10px] font-black leading-none text-oriwan-text shadow-[inset_0_0_0_1px_rgba(16,21,34,0.05)]">
                            <span className="text-[8px] font-extrabold text-oriwan-text-muted">총거리</span>
                            <AnimatedMetricNumber value={row.distanceKm} suffix="km" />
                          </span>
                          <span className="inline-flex items-baseline gap-1 rounded-full bg-oriwan-surface-light px-2 py-0.5 text-[10px] font-black leading-none text-oriwan-text shadow-[inset_0_0_0_1px_rgba(16,21,34,0.05)]">
                            <span className="text-[8px] font-extrabold text-oriwan-text-muted">총시간</span>
                            {secondsToTime(row.durationSeconds)}
                          </span>
                        </div>
                      </div>
                      <p className={`shrink-0 text-xl font-black leading-none ${gaugeTextClass(row.certifiedDays)}`}>
                        <AnimatedNumber value={row.rate} suffix="%" />
                      </p>
                    </div>
                    <div className={`mt-2 hidden h-1.5 overflow-hidden rounded-full bg-oriwan-surface-light sm:block ${isTopRunner ? "mr-9" : ""}`}>
                      <div
                        className={`gauge-fill-flow h-full rounded-full transition-all duration-1000 ease-out ${gaugeColorClass(row.certifiedDays)}`}
                        style={{
                          width: `${motionReady ? Math.max(row.rate, row.certifiedDays ? 3 : 0) : 0}%`,
                          transitionDelay: `${Math.min(index * 45, 500)}ms`,
                        }}
                      />
                    </div>
                  </button>
                  );
                })}
                {!dashboard.participantProgress.length && !loading && (
                  <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-oriwan-text-muted sm:col-span-2 lg:col-span-3">
                    멤버가 추가되면 인증게이지가 바로 채워집니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-3xl bg-rose-50 px-5 py-4 text-sm font-bold text-rose-900 ring-1 ring-rose-100">
            {error}
          </div>
        )}

        {data?.setup_required && (
          <div className="mt-4 rounded-3xl bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950 ring-1 ring-amber-100">
            아직 운영 데이터가 연결되지 않았어요. Supabase 스키마를 적용하면 멤버들의 러닝 보드가 바로 열립니다.
          </div>
        )}

        <YoutubeShortsSection />

        <p className="py-6 text-center text-[11px] font-semibold text-oriwan-text-muted">
          {loading ? "오늘의 기록을 데려오는 중..." : `마지막 업데이트 ${formatLastUpdated(data?.generated_at)}`}
        </p>

        {selectedParticipant && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => {
              setSelectedParticipantId("");
              setSelectedDailyRecordDate("");
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
                    }}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                    aria-label="닫기"
                  >
                    <IconX size={18} />
                  </button>
                </div>
                <div className="mt-2 flex min-w-0 items-center gap-2">
                  <MemberPictogram index={selectedParticipant.pictogramIndex} participantName={selectedParticipant.participant.name} size="lg" />
                  <h3 className="min-w-0 truncate text-2xl font-black leading-tight text-oriwan-text">{selectedParticipant.participant.name}</h3>
                </div>
                {selectedParticipant.participant.nickname && (
                  <p className="mt-3 w-full whitespace-pre-line break-keep rounded-2xl bg-oriwan-surface-light px-4 py-3 text-sm font-bold leading-6 text-oriwan-text">
                    {selectedParticipant.participant.nickname}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-1.5">
                {dashboard.stampDays.map((day) => {
                  const stamped = selectedStampedDates.has(day);
                  const dayRecord = selectedRecordByDate.get(day);
                  const isSelected = selectedDailyRecordDate === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!stamped}
                      onClick={() => {
                        if (stamped) setSelectedDailyRecordDate(day);
                      }}
                      title={day}
                      className={`stamp-cell flex aspect-square flex-col items-center justify-center rounded-xl border text-[10px] font-black transition sm:rounded-2xl ${
                        stamped
                          ? "stamp-cell-hit border-lime-300 bg-lime-300 text-slate-950 shadow-sm shadow-lime-300/40"
                          : "border-slate-950/5 bg-white text-oriwan-text-muted/45"
                      } ${isSelected ? "scale-105 ring-2 ring-slate-950" : ""}`}
                    >
                      <span>{shortDate(day)}</span>
                      <span className="mt-0.5 text-xs">{dayRecord ? "✓" : "·"}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-[22px] bg-oriwan-surface-light p-3 ring-1 ring-slate-950/5 sm:rounded-[24px] sm:p-4">
                {selectedDailyRecord ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-oriwan-text">{selectedDailyRecordDate} 러닝 기록</p>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-oriwan-text-muted">
                        {selectedDailyRecord.status === "certified" ? "인증" : "확인 중"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <p className="text-[10px] font-black text-oriwan-text-muted">거리</p>
                        <p className="mt-1 text-2xl font-black leading-tight text-oriwan-text">
                          {selectedDailyRecord.distance_km ? `${selectedDailyRecord.distance_km.toFixed(2)}km` : "-"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <p className="text-[10px] font-black text-oriwan-text-muted">시간</p>
                        <p className="mt-1 text-2xl font-black leading-tight text-oriwan-text">
                          {secondsToTime(selectedDailyRecord.duration_seconds)}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-oriwan-text">개인 성장 뱃지</p>
                        <p className="mt-0.5 text-[11px] font-bold text-oriwan-text-muted">오전 러닝과 꾸준한 인증을 기준으로 열려요.</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[10px] font-black text-oriwan-text-muted">
                        {unlockedSelectedBadgeCount}/{selectedPersonalGrowthBadges.length}
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedPersonalGrowthBadges.map((badge) => (
                        <div
                          key={badge.key}
                          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 ring-slate-950/5 ${
                            badge.unlocked ? "bg-white text-oriwan-text" : "bg-white/60 text-oriwan-text-muted"
                          }`}
                        >
                          <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                            badge.unlocked ? badge.colorClassName : "bg-white text-oriwan-text-muted ring-1 ring-slate-950/5"
                          }`}>
                            <GrowthBadgeIcon icon={badge.icon} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-black">{badge.label}</span>
                            <span className="mt-0.5 block truncate text-[10px] font-bold opacity-70">{badge.description}</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-oriwan-surface-light px-2 py-1 text-[10px] font-black text-oriwan-text-muted">
                            {badge.progress}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {showSeasonReportModal && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
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
            </div>
          </div>
        )}

        {trendModal && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
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
                  <line x1={trendGraph.padding} y1={trendGraph.height - trendGraph.padding} x2={trendGraph.width - trendGraph.padding} y2={trendGraph.height - trendGraph.padding} stroke="rgba(255,255,255,.16)" strokeWidth="2" />
                  <line x1={trendGraph.padding} y1={trendGraph.padding} x2={trendGraph.padding} y2={trendGraph.height - trendGraph.padding} stroke="rgba(255,255,255,.12)" strokeWidth="2" />
                  <path key={trendModal} d={trendGraph.path} fill="none" stroke="#bef264" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="dashboard-line-draw" />
                  {trendGraph.points.map((point, index) => (
                    <g key={`${trendModal}-${index}`} className="dashboard-dot-pop" style={{ animationDelay: `${Math.min(index * 70, 700)}ms` }}>
                      <circle cx={point.x} cy={point.y} r="5" fill="#bef264" />
                      <text x={point.x} y={Math.max(14, point.y - 10)} textAnchor="middle" className="fill-white text-[10px] font-black">{trendItems[index]?.value || 0}%</text>
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
