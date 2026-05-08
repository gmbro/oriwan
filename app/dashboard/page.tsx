"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildMemberPictogramMap, MemberPictogram } from "@/components/member-pictogram";
import { YoutubeShortsSection } from "@/components/youtube-shorts-section";
import { ACTUAL_CERTIFICATION_START_DATE, CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_DAYS } from "@/lib/challenge";
import { DASHBOARD_REFRESH_CHANNEL, DASHBOARD_REFRESH_EVENT } from "@/lib/dashboard-refresh";
import { addDays, secondsToTime, toIsoDate } from "@/lib/run-records";
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
  pace_seconds_per_km: number | null;
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

type TrendModal = "weekly" | "cumulative" | null;

const today = toIsoDate(new Date());
const actualCertificationEndDate = toIsoDate(addDays(new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`), CHALLENGE_DAYS - 1));
const effectiveToday = today > actualCertificationEndDate ? actualCertificationEndDate : today;

function formatLastUpdated(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function certificationDayLabel() {
  const start = new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`);
  const current = new Date(`${effectiveToday}T00:00:00`);
  const diffDays = Math.floor((current.getTime() - start.getTime()) / 86_400_000);
  if (diffDays < 0) return `D-${CHALLENGE_DAYS}`;
  return `D-${Math.max(CHALLENGE_DAYS - diffDays, 0)}`;
}

function shortDate(value: string) {
  return value.slice(5).replace("-", ".");
}

function todayLabel() {
  return shortDate(today);
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

function crewLevelBadge(certifiedDays: number, rate: number) {
  if (rate >= 100) return { label: "FINISHER", className: "bg-slate-950 text-lime-200" };
  if (certifiedDays >= 51) return { label: "GREEN RUNNER", className: "bg-lime-300 text-slate-950" };
  if (certifiedDays >= 11) return { label: "PACE UP", className: "bg-amber-200 text-amber-900" };
  if (certifiedDays >= 1) return { label: "STARTER", className: "bg-rose-100 text-rose-700" };
  return { label: "READY", className: "bg-slate-100 text-slate-500" };
}

const officialCertificationDays = makeOfficialCertificationDays();
const RING_CIRCUMFERENCE = 302;

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
      setDisplayValue(value);
      return;
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
      setDisplayValue(value);
      return;
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
  const [motionReady, setMotionReady] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [trendModal, setTrendModal] = useState<TrendModal>(null);
  const loadingRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await fetch("/api/public-dashboard?scope=all", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "오늘의 보드를 불러오지 못했어요.");
      setData(json);
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
      if (document.visibilityState === "visible") load();
    }, 350);
  }, [load]);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(DASHBOARD_REFRESH_CHANNEL)
      .on("broadcast", { event: DASHBOARD_REFRESH_EVENT }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_run_records" }, scheduleRefresh)
      .subscribe();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 10000);
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
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
    if (reduceMotion) {
      setMotionReady(true);
      return;
    }

    const frame = requestAnimationFrame(() => setMotionReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const dashboard = useMemo(() => {
    const participants = data?.participants || [];
    const records = data?.records || [];
    const certifiedRecords = records.filter((record) => record.status === "certified");
    const officialCertifiedRecords = certifiedRecords.filter(
      (record) => Boolean(record.record_date && record.record_date >= ACTUAL_CERTIFICATION_START_DATE && record.record_date <= actualCertificationEndDate)
    );
    const todayRecords = officialCertifiedRecords.filter((record) => record.record_date === today);
    const todayCertifiedIds = new Set(
      todayRecords
        .filter((record) => record.participant_id)
        .map((record) => record.participant_id)
    );

    const completionRate = participants.length ? Math.round((todayCertifiedIds.size / participants.length) * 100) : 0;

    const certifiedIdsByDay = new Map<string, Set<string>>();
    const certifiedDaysByParticipant = new Map<string, Set<string>>();
    const officialMetricsByParticipant = new Map<string, { distanceKm: number; durationSeconds: number }>();

    officialCertifiedRecords.forEach((record) => {
      if (!record.participant_id || !record.record_date) return;
      if (!certifiedIdsByDay.has(record.record_date)) certifiedIdsByDay.set(record.record_date, new Set());
      certifiedIdsByDay.get(record.record_date)?.add(record.participant_id);

      if (!certifiedDaysByParticipant.has(record.participant_id)) certifiedDaysByParticipant.set(record.participant_id, new Set());
      certifiedDaysByParticipant.get(record.participant_id)?.add(record.record_date);

      const metrics = officialMetricsByParticipant.get(record.participant_id) || { distanceKm: 0, durationSeconds: 0 };
      metrics.distanceKm += record.distance_km || 0;
      metrics.durationSeconds += record.duration_seconds || 0;
      officialMetricsByParticipant.set(record.participant_id, metrics);
    });

    const stampDatesByParticipant = new Map<string, Set<string>>();
    const latestStampDate = certifiedRecords.reduce((latest, record) => {
      if (!record.record_date) return latest;
      return record.record_date > latest ? record.record_date : latest;
    }, today > CERTIFICATION_DISPLAY_START_DATE ? today : CERTIFICATION_DISPLAY_START_DATE);

    certifiedRecords.forEach((record) => {
      if (!record.participant_id || !record.record_date) return;
      if (!stampDatesByParticipant.has(record.participant_id)) stampDatesByParticipant.set(record.participant_id, new Set());
      stampDatesByParticipant.get(record.participant_id)?.add(record.record_date);
    });

    const elapsedDays = officialCertificationDays.filter((day) => day <= effectiveToday);
    const dayTrend = elapsedDays.map((day) => {
      const certifiedCount = certifiedIdsByDay.get(day)?.size || 0;
      const rate = participants.length ? Math.round((certifiedCount / participants.length) * 100) : 0;
      return { day, certifiedCount, rate };
    });
    const certifiedCountByDay = new Map(dayTrend.map((day) => [day.day, day.certifiedCount]));
    const visibleOfficialWeeks = Array.from({ length: Math.ceil(officialCertificationDays.length / 7) }, (_, index) => {
      const weekDays = officialCertificationDays.slice(index * 7, index * 7 + 7);
      return { index, weekDays };
    }).filter((week) => week.weekDays[0] && week.weekDays[0] <= effectiveToday);
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
    const totalCertifiedSlots = dayTrend.reduce((sum, day) => sum + day.certifiedCount, 0);
    const possibleCertifiedSlots = officialCertificationDays.length * participants.length;
    const cumulativeRate = possibleCertifiedSlots ? Math.round((totalCertifiedSlots / possibleCertifiedSlots) * 100) : 0;
    let runningCertifiedSlots = 0;
    const cumulativeTrend = dayTrend.map((day, index) => {
      runningCertifiedSlots += day.certifiedCount;
      return {
        label: shortDate(day.day),
        value: possibleCertifiedSlots ? Math.round((runningCertifiedSlots / possibleCertifiedSlots) * 100) : 0,
        caption: `${shortDate(day.day)} · 누적 ${runningCertifiedSlots}건`,
      };
    });
    const pictogramByParticipantId = buildMemberPictogramMap(participants);
    const participantProgress = participants
      .map((participant) => {
        const certifiedDates = Array.from(certifiedDaysByParticipant.get(participant.id) || []).sort();
        const stampedDates = Array.from(stampDatesByParticipant.get(participant.id) || []).sort();
        const metrics = officialMetricsByParticipant.get(participant.id) || { distanceKm: 0, durationSeconds: 0 };
        const certifiedDays = certifiedDates.length;
        const rate = Math.min(Math.round((certifiedDays / CHALLENGE_DAYS) * 100), 100);
        return {
          participant,
          pictogramIndex: pictogramByParticipantId.get(participant.id) ?? 0,
          certifiedDates,
          stampedDates,
          certifiedDays,
          rate,
          badge: crewLevelBadge(certifiedDays, rate),
          ...metrics,
        };
      })
      .sort((a, b) => b.certifiedDays - a.certifiedDays || a.participant.name.localeCompare(b.participant.name, "ko"));

    return {
      participants,
      todayCertifiedIds,
      completionRate,
      elapsedDays,
      dayTrend,
      weekTrend,
      cumulativeTrend,
      totalCertifiedSlots,
      cumulativeRate,
      participantProgress,
      stampDays: makeDaysThrough(CERTIFICATION_DISPLAY_START_DATE, latestStampDate),
    };
  }, [data]);
  const latestWeeklyRate = dashboard.weekTrend.at(-1)?.averageRate || 0;
  const selectedParticipant = dashboard.participantProgress.find((row) => row.participant.id === selectedParticipantId) || null;
  const selectedStampedDates = new Set(selectedParticipant?.stampedDates || []);
  const trendItems = trendModal === "weekly"
    ? dashboard.weekTrend.map((week) => ({
      label: week.label,
      value: week.averageRate,
      caption: week.to ? `${week.label} · ${shortDate(week.from)}-${shortDate(week.to)}` : week.label,
    }))
    : dashboard.cumulativeTrend;
  const trendGraph = makeGraphPath(trendItems);

  return (
    <main className="min-h-screen bg-oriwan-bg">
      <header className="sticky top-0 z-50 border-b border-slate-950/10 bg-[#101522]/95 px-4 py-3 text-white backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/oriwan-logo-v2.png" alt="스내사 러닝보드" width={38} height={38} className="rounded-2xl bg-lime-300" />
            <div className="min-w-0">
              <h1 className="truncate text-[26px] font-black leading-none tracking-[-0.06em] sm:text-[30px]">스내사 러닝보드</h1>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-4 sm:py-6">
        <section className="overflow-hidden rounded-[32px] bg-white/85 shadow-2xl shadow-slate-950/10 ring-1 ring-slate-950/5">
          <div className="relative overflow-hidden bg-[#101522] p-5 text-white sm:p-7">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-lime-300/25 blur-3xl" />
            <div className="absolute bottom-0 left-8 h-32 w-72 rounded-full bg-orange-400/15 blur-3xl" />
            <div className="relative grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
              <div>
                <div className="mb-3 flex max-w-full flex-nowrap gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
                  <p className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-black text-lime-200 ring-1 ring-white/10 sm:px-3 sm:text-[11px]">
                    {todayLabel()}
                  </p>
                  <p className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-lime-300 px-2.5 py-1 text-[9px] font-black text-slate-950 sm:px-3 sm:text-[11px]">
                    {certificationDayLabel()}
                  </p>
                </div>
                <h2 className="max-w-full whitespace-nowrap text-[clamp(1.95rem,8vw,3.75rem)] font-black leading-[1.05] tracking-[-0.07em]">
                  오늘, 얼마나 인증했을까?
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
                  인증 기록은 매일 정오에 산뜻하게 업데이트됩니다.
                </p>
              </div>

              <div className="rounded-[28px] bg-white/10 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-white/45">오늘 인증률</p>
                    <p className="mt-1 text-5xl font-black tracking-[-0.08em] text-lime-200">
                      <AnimatedNumber value={dashboard.completionRate} suffix="%" />
                    </p>
                  </div>
                  <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90 dashboard-ring-pop">
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
                  {dashboard.todayCertifiedIds.size}/{dashboard.participants.length}명 인증 완료
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-3 gap-2">
              <div className="dashboard-card-reveal rounded-3xl bg-white px-3 py-4 text-center ring-1 ring-slate-950/5 [animation-delay:0ms]">
                <p className="text-[10px] font-black text-oriwan-text-muted">진행일</p>
                <p className="mt-1 text-2xl font-black tracking-[-0.06em] text-oriwan-text">
                  <AnimatedNumber value={dashboard.elapsedDays.length} />/{CHALLENGE_DAYS}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTrendModal("weekly")}
                className="dashboard-card-reveal rounded-3xl bg-white px-3 py-4 text-center ring-1 ring-slate-950/5 transition hover:-translate-y-0.5 hover:ring-lime-300 [animation-delay:90ms]"
              >
                <p className="text-[10px] font-black text-oriwan-text-muted">주차별 인증률</p>
                <p className="mt-1 text-2xl font-black tracking-[-0.06em] text-oriwan-text">
                  <AnimatedNumber value={latestWeeklyRate} suffix="%" />
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTrendModal("cumulative")}
                className="dashboard-card-reveal rounded-3xl bg-lime-300 px-3 py-4 text-center text-slate-950 shadow-sm shadow-lime-300/30 transition hover:-translate-y-0.5 hover:ring-2 hover:ring-lime-400 [animation-delay:180ms]"
              >
                <p className="text-[10px] font-black opacity-60">누적 인증률</p>
                <p className="mt-1 text-2xl font-black tracking-[-0.06em]">
                  <AnimatedNumber value={dashboard.cumulativeRate} suffix="%" />
                </p>
              </button>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-base font-black tracking-[-0.03em] text-oriwan-text">스내사 크루별 인증게이지</h4>
                <span className="inline-flex shrink-0 rounded-full bg-lime-300 px-3 py-1 text-[11px] font-black text-slate-950 shadow-sm shadow-lime-300/30">
                  멤버 {dashboard.participants.length}명
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.participantProgress.map((row, index) => (
                  <button
                    key={row.participant.id}
                    type="button"
                    onClick={() => setSelectedParticipantId(row.participant.id)}
                    className={`relative overflow-hidden rounded-2xl bg-white px-3 py-3 text-left ring-1 ring-slate-950/5 transition hover:-translate-y-0.5 hover:ring-lime-300 ${
                    row.rate >= 100 ? "gauge-complete-card" : "dashboard-gauge-card"
                    }`}
                  >
                    {row.rate >= 100 && <FanfareBurst compact />}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <MemberPictogram index={row.pictogramIndex} participantName={row.participant.name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-oriwan-text">{row.participant.name}</p>
                          <span className={`crew-level-badge mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${row.badge.className}`}>
                            {row.badge.label}
                          </span>
                        </div>
                      </div>
                      <p className={`shrink-0 text-lg font-black tracking-[-0.06em] ${gaugeTextClass(row.certifiedDays)}`}>
                        <AnimatedNumber value={row.rate} suffix="%" />
                      </p>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-oriwan-surface-light">
                      <div
                        className={`gauge-fill-flow h-full rounded-full transition-all duration-1000 ease-out ${gaugeColorClass(row.certifiedDays)}`}
                        style={{
                          width: `${motionReady ? Math.max(row.rate, row.certifiedDays ? 3 : 0) : 0}%`,
                          transitionDelay: `${Math.min(index * 45, 500)}ms`,
                        }}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-black">
                      <span className="crew-metric-chip rounded-xl bg-oriwan-surface-light px-2 py-1.5 text-oriwan-text-muted">
                        <span className="block text-[9px] opacity-70">총거리</span>
                        <span className="block text-sm leading-tight text-oriwan-text">
                          <AnimatedMetricNumber value={row.distanceKm} suffix="km" />
                        </span>
                      </span>
                      <span className="crew-metric-chip rounded-xl bg-oriwan-surface-light px-2 py-1.5 text-oriwan-text-muted">
                        <span className="block text-[9px] opacity-70">총시간</span>
                        <span className="block text-sm leading-tight text-oriwan-text">{secondsToTime(row.durationSeconds)}</span>
                      </span>
                    </div>
                  </button>
                ))}
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
          <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:items-center sm:justify-center">
            <div className="card modal-rise max-h-[88vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
              {selectedParticipant.rate >= 100 && <FanfareBurst />}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${
                    selectedParticipant.rate >= 100 ? "bg-slate-950 text-lime-200" : "bg-lime-300 text-slate-950"
                  }`}>
                    {selectedParticipant.rate >= 100 ? "100% 완주!" : `${selectedParticipant.rate}%`}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <MemberPictogram index={selectedParticipant.pictogramIndex} participantName={selectedParticipant.participant.name} size="lg" />
                    <h3 className="text-2xl font-black tracking-[-0.05em] text-oriwan-text">{selectedParticipant.participant.name}</h3>
                  </div>
                  {selectedParticipant.participant.nickname && (
                    <p className="mt-2 whitespace-pre-line rounded-2xl bg-oriwan-surface-light px-4 py-3 text-sm font-bold leading-6 text-oriwan-text">
                      {selectedParticipant.participant.nickname}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedParticipantId("")}
                  className="rounded-full bg-oriwan-surface-light px-3 py-1.5 text-xs font-black text-oriwan-text-muted"
                >
                  닫기
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {dashboard.stampDays.map((day) => {
                  const stamped = selectedStampedDates.has(day);
                  return (
                    <div
                      key={day}
                      title={day}
                      className={`stamp-cell flex aspect-square flex-col items-center justify-center rounded-2xl border text-[10px] font-black ${
                        stamped
                          ? "stamp-cell-hit border-lime-300 bg-lime-300 text-slate-950 shadow-sm shadow-lime-300/40"
                          : "border-slate-950/5 bg-white text-oriwan-text-muted/45"
                      }`}
                    >
                      <span>{shortDate(day)}</span>
                      <span className="mt-0.5 text-xs">{stamped ? "✓" : "·"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {trendModal && (
          <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:items-center sm:justify-center">
            <div className="card w-full max-w-2xl p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-lime-200">
                    {trendModal === "weekly" ? "주차별 인증률" : "누적 인증률"}
                  </p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.05em] text-oriwan-text">
                    {trendModal === "weekly" ? "주차별 흐름" : "누적 흐름"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setTrendModal(null)}
                  className="rounded-full bg-oriwan-surface-light px-3 py-1.5 text-xs font-black text-oriwan-text-muted"
                >
                  닫기
                </button>
              </div>
              <div className="rounded-[28px] bg-slate-950 p-4 text-white">
                <svg viewBox={`0 0 ${trendGraph.width} ${trendGraph.height}`} className="h-52 w-full overflow-visible">
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
