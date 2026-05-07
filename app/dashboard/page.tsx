"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { YoutubeShortsSection } from "@/components/youtube-shorts-section";
import { ACTUAL_CERTIFICATION_START_DATE, CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_DAYS, CHALLENGE_END_DATE } from "@/lib/challenge";
import { addDays, toIsoDate } from "@/lib/run-records";

type Participant = {
  id: string;
  name: string;
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

function shortDateRange(start: string, end: string) {
  return `${start.slice(5).replace("-", ".")}-${end.slice(5).replace("-", ".")}`;
}

function shortDate(value: string) {
  return value.slice(5).replace("-", ".");
}

function makeChallengeDays() {
  const start = new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`);
  return Array.from({ length: CHALLENGE_DAYS }, (_, index) => toIsoDate(addDays(start, index)))
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

const challengeDays = makeChallengeDays();
const RING_CIRCUMFERENCE = 302;

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

export default function DashboardPage() {
  const [data, setData] = useState<PublicDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [motionReady, setMotionReady] = useState(false);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await fetch("/api/public-dashboard?days=100", { cache: "no-store" });
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

  useEffect(() => {
    load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

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
    const todayRecords = certifiedRecords.filter((record) => record.record_date === today);
    const todayCertifiedIds = new Set(
      todayRecords
        .filter((record) => record.participant_id)
        .map((record) => record.participant_id)
    );

    const completionRate = participants.length ? Math.round((todayCertifiedIds.size / participants.length) * 100) : 0;

    const certifiedIdsByDay = new Map<string, Set<string>>();
    const certifiedDaysByParticipant = new Map<string, Set<string>>();

    certifiedRecords.forEach((record) => {
      if (!record.participant_id || !record.record_date) return;
      if (!certifiedIdsByDay.has(record.record_date)) certifiedIdsByDay.set(record.record_date, new Set());
      certifiedIdsByDay.get(record.record_date)?.add(record.participant_id);

      if (!certifiedDaysByParticipant.has(record.participant_id)) certifiedDaysByParticipant.set(record.participant_id, new Set());
      certifiedDaysByParticipant.get(record.participant_id)?.add(record.record_date);
    });

    const elapsedDays = challengeDays.filter((day) => day <= effectiveToday);
    const dayTrend = elapsedDays.map((day) => {
      const certifiedCount = certifiedIdsByDay.get(day)?.size || 0;
      const rate = participants.length ? Math.round((certifiedCount / participants.length) * 100) : 0;
      return { day, certifiedCount, rate };
    });
    const weekTrend = Array.from({ length: Math.ceil(dayTrend.length / 7) }, (_, index) => {
      const days = dayTrend.slice(index * 7, index * 7 + 7);
      const certifiedSlots = days.reduce((sum, day) => sum + day.certifiedCount, 0);
      const possibleSlots = days.length * participants.length;
      const averageRate = possibleSlots ? Math.round((certifiedSlots / possibleSlots) * 100) : 0;
      return {
        label: `${index + 1}주`,
        from: days[0]?.day || "",
        to: days.at(-1)?.day || "",
        averageRate,
        averageCount: days.length ? Math.round(certifiedSlots / days.length) : 0,
      };
    });
    const totalCertifiedSlots = dayTrend.reduce((sum, day) => sum + day.certifiedCount, 0);
    const possibleCertifiedSlots = elapsedDays.length * participants.length;
    const cumulativeRate = possibleCertifiedSlots ? Math.round((totalCertifiedSlots / possibleCertifiedSlots) * 100) : 0;
    const participantProgress = participants
      .map((participant) => {
        const certifiedDays = certifiedDaysByParticipant.get(participant.id)?.size || 0;
        const rate = Math.round((certifiedDays / CHALLENGE_DAYS) * 100);
        return { participant, certifiedDays, rate };
      })
      .sort((a, b) => b.certifiedDays - a.certifiedDays || a.participant.name.localeCompare(b.participant.name, "ko"));

    return {
      participants,
      todayCertifiedIds,
      completionRate,
      elapsedDays,
      weekTrend,
      totalCertifiedSlots,
      cumulativeRate,
      participantProgress,
    };
  }, [data]);
  const latestWeeklyRate = dashboard.weekTrend.at(-1)?.averageRate || 0;

  return (
    <main className="min-h-screen bg-oriwan-bg">
      <header className="sticky top-0 z-50 border-b border-slate-950/10 bg-[#101522]/95 px-4 py-3 text-white backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image src="/oriwan-logo-v2.png" alt="스내사 3기" width={38} height={38} className="rounded-2xl bg-lime-300" />
            <div>
              <h1 className="text-base font-black tracking-[-0.03em] sm:text-lg">스내사 3기 대시보드</h1>
              <p className="text-[11px] font-semibold text-white/50">오늘 인증을 한눈에 보는 보드</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-white/45">함께 뛰는 멤버 {dashboard.participants.length}명</p>
            <Link href="/me" className="mt-1 inline-flex rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/80 ring-1 ring-white/10 hover:text-white">
              내 기록 올리기
            </Link>
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
                    함께 뛰는 기간 · {shortDateRange(CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_END_DATE)}
                  </p>
                  <p className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-lime-300 px-2.5 py-1 text-[9px] font-black text-slate-950 sm:px-3 sm:text-[11px]">
                    인증 시작 {certificationDayLabel()} · {shortDate(ACTUAL_CERTIFICATION_START_DATE)}부터
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
              <div className="dashboard-card-reveal rounded-3xl bg-white px-3 py-4 text-center ring-1 ring-slate-950/5 [animation-delay:90ms]">
                <p className="text-[10px] font-black text-oriwan-text-muted">주차별 인증률</p>
                <p className="mt-1 text-2xl font-black tracking-[-0.06em] text-oriwan-text">
                  <AnimatedNumber value={latestWeeklyRate} suffix="%" />
                </p>
              </div>
              <div className="dashboard-card-reveal rounded-3xl bg-lime-300 px-3 py-4 text-center text-slate-950 shadow-sm shadow-lime-300/30 [animation-delay:180ms]">
                <p className="text-[10px] font-black opacity-60">누적 인증률</p>
                <p className="mt-1 text-2xl font-black tracking-[-0.06em]">
                  <AnimatedNumber value={dashboard.cumulativeRate} suffix="%" />
                </p>
              </div>
            </div>

            <div className="mt-5">
              <h4 className="mb-3 text-base font-black tracking-[-0.03em] text-oriwan-text">스내사 크루별 인증게이지</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.participantProgress.map((row, index) => (
                  <div key={row.participant.id} className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-950/5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-black text-oriwan-text">{row.participant.name}</p>
                      <p className={`shrink-0 text-xs font-black ${gaugeTextClass(row.certifiedDays)}`}>
                        {row.certifiedDays}/{CHALLENGE_DAYS}일
                      </p>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-oriwan-surface-light">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${gaugeColorClass(row.certifiedDays)}`}
                        style={{
                          width: `${motionReady ? Math.max(row.rate, row.certifiedDays ? 3 : 0) : 0}%`,
                          transitionDelay: `${Math.min(index * 45, 500)}ms`,
                        }}
                      />
                    </div>
                  </div>
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
      </section>
    </main>
  );
}
