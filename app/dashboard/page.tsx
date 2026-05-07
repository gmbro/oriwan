"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck } from "@/components/icons";
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

type BoardFilter = "all" | "certified" | "missing";
type PublicBoardStatus = "certified" | "missing";
type DashboardTab = "today" | "trend";

const today = toIsoDate(new Date());
const actualCertificationEndDate = toIsoDate(addDays(new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`), CHALLENGE_DAYS - 1));
const effectiveToday = today > actualCertificationEndDate ? actualCertificationEndDate : today;
const boardFilterOptions: { value: BoardFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "certified", label: "인증" },
  { value: "missing", label: "미인증" },
];
const dashboardTabOptions: { value: DashboardTab; label: string }[] = [
  { value: "today", label: "오늘 현황" },
  { value: "trend", label: "인증 흐름" },
];

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

function publicBoardStatus(record?: RunRecord): PublicBoardStatus {
  return record?.status === "certified" ? "certified" : "missing";
}

function publicStatusLabel(status: PublicBoardStatus) {
  return status === "certified" ? "인증" : "미인증";
}

function publicCardClass(status: PublicBoardStatus) {
  if (status === "certified") return "bg-lime-300 text-slate-950 ring-lime-400/70 shadow-sm shadow-lime-300/40";
  return "bg-white text-slate-500 ring-slate-950/5";
}

const challengeDays = makeChallengeDays();

export default function DashboardPage() {
  const [data, setData] = useState<PublicDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all");
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("today");
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await fetch("/api/public-dashboard?days=100", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "대시보드 조회 실패");
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

    const byParticipantDate = new Map<string, RunRecord>();
    const certifiedIdsByDay = new Map<string, Set<string>>();
    const certifiedDaysByParticipant = new Map<string, Set<string>>();

    records.forEach((record) => {
      if (record.participant_id && record.record_date) {
        const key = `${record.participant_id}:${record.record_date}`;
        const existing = byParticipantDate.get(key);
        if (!existing || record.status === "certified") byParticipantDate.set(key, record);
      }
    });

    certifiedRecords.forEach((record) => {
      if (!record.participant_id || !record.record_date) return;
      if (!certifiedIdsByDay.has(record.record_date)) certifiedIdsByDay.set(record.record_date, new Set());
      certifiedIdsByDay.get(record.record_date)?.add(record.participant_id);

      if (!certifiedDaysByParticipant.has(record.participant_id)) certifiedDaysByParticipant.set(record.participant_id, new Set());
      certifiedDaysByParticipant.get(record.participant_id)?.add(record.record_date);
    });

    const boardCards = participants.map((participant) => {
      const record = byParticipantDate.get(`${participant.id}:${today}`);
      const status = publicBoardStatus(record);
      return { participant, record, status };
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
        const rate = elapsedDays.length ? Math.round((certifiedDays / elapsedDays.length) * 100) : 0;
        return { participant, certifiedDays, rate };
      })
      .sort((a, b) => b.certifiedDays - a.certifiedDays || a.participant.name.localeCompare(b.participant.name, "ko"));

    return {
      participants,
      boardCards,
      todayCertifiedIds,
      completionRate,
      elapsedDays,
      weekTrend,
      totalCertifiedSlots,
      cumulativeRate,
      participantProgress,
    };
  }, [data]);

  const boardRows = useMemo(() => {
    if (boardFilter === "all") return dashboard.boardCards;
    return dashboard.boardCards.filter((row) => row.status === boardFilter);
  }, [boardFilter, dashboard.boardCards]);

  return (
    <main className="min-h-screen bg-oriwan-bg">
      <header className="sticky top-0 z-50 border-b border-slate-950/10 bg-[#101522]/95 px-4 py-3 text-white backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image src="/oriwan-logo-v2.png" alt="스내사 3기" width={38} height={38} className="rounded-2xl bg-lime-300" />
            <div>
              <h1 className="text-base font-black tracking-[-0.03em] sm:text-lg">스내사 3기 대시보드</h1>
              <p className="text-[11px] font-semibold text-white/50">오늘의 러닝 인증 현황</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-white/45">참가자 {dashboard.participants.length}명</p>
            <Link href="/me" className="mt-1 inline-flex rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/80 ring-1 ring-white/10 hover:text-white">
              내 기록 입력
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
                    운영기간 · {shortDateRange(CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_END_DATE)}
                  </p>
                  <p className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-lime-300 px-2.5 py-1 text-[9px] font-black text-slate-950 sm:px-3 sm:text-[11px]">
                    인증시작 {certificationDayLabel()} · {shortDate(ACTUAL_CERTIFICATION_START_DATE)}부터
                  </p>
                </div>
                <h2 className="max-w-full whitespace-nowrap text-[clamp(1.95rem,8vw,3.75rem)] font-black leading-[1.05] tracking-[-0.07em]">
                  오늘, 얼마나 인증했을까?
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
                  인증 기록은 매일 정오에 업데이트됩니다.
                </p>
              </div>

              <div className="rounded-[28px] bg-white/10 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-white/45">오늘 인증률</p>
                    <p className="mt-1 text-5xl font-black tracking-[-0.08em] text-lime-200">{dashboard.completionRate}%</p>
                  </div>
                  <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="14" />
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke="#bef264"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={`${dashboard.completionRate * 3.02} 302`}
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
            <div className="mb-4 grid grid-cols-2 rounded-full bg-oriwan-surface-light p-1 ring-1 ring-slate-950/5">
              {dashboardTabOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDashboardTab(option.value)}
                  className={`rounded-full px-3 py-2 text-xs font-black transition ${
                    dashboardTab === option.value ? "bg-slate-950 text-lime-200 shadow-sm" : "text-oriwan-text-muted hover:text-oriwan-text"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {dashboardTab === "today" ? (
              <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black tracking-[-0.03em] text-oriwan-text">오늘의 인증 현황</h3>
                  <span className="rounded-full bg-lime-100 px-2.5 py-1 text-[11px] font-black text-lime-900">
                    {dashboard.todayCertifiedIds.size}/{dashboard.participants.length}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-oriwan-text-muted">인증한 사람과 아직 남은 사람을 빠르게 나눠 볼 수 있어요.</p>
              </div>
              <div className="grid grid-cols-3 rounded-full bg-oriwan-surface-light p-1 ring-1 ring-slate-950/5 sm:min-w-[240px]">
                {boardFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBoardFilter(option.value)}
                    className={`rounded-full px-2 py-1.5 text-[11px] font-black transition ${
                      boardFilter === option.value ? "bg-slate-950 text-lime-200 shadow-sm" : "text-oriwan-text-muted hover:text-oriwan-text"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
              {boardRows.map((row) => (
                <article
                  key={row.participant.id}
                  title={`${row.participant.name} · 오늘 ${publicStatusLabel(row.status)}`}
                  className={`min-h-[54px] rounded-2xl px-2 py-2 text-center ring-1 transition ${publicCardClass(row.status)}`}
                >
                  <span
                    className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                      row.status === "certified" ? "bg-slate-950 text-lime-200" : "bg-slate-100 text-slate-300"
                    }`}
                  >
                    {row.status === "certified" ? <IconCheck size={12} /> : "-"}
                  </span>
                  <p className="mt-1 truncate text-[12px] font-black tracking-[-0.04em] sm:text-[13px]">{row.participant.name}</p>
                  <p className="mt-0.5 text-[9px] font-black opacity-60">{publicStatusLabel(row.status)}</p>
                </article>
              ))}
              {!boardRows.length && !loading && (
                <p className="col-span-3 py-8 text-center text-sm text-oriwan-text-muted md:col-span-5 lg:col-span-7">
                  조건에 맞는 참가자가 없습니다.
                </p>
              )}
            </div>
              </>
            ) : (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-lime-200">
                      100일 인증 흐름
                    </p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-oriwan-text">우리의 인증 흐름</h3>
                    <p className="mt-1 text-xs font-semibold text-oriwan-text-muted">
                      {shortDate(ACTUAL_CERTIFICATION_START_DATE)}부터 100일 동안 쌓이는 인증 기록입니다. 현재 {dashboard.elapsedDays.length}/{CHALLENGE_DAYS}일째예요.
                    </p>
                  </div>
                  <p className="text-xs font-black text-oriwan-text-muted">
                    지금까지 인증 {dashboard.totalCertifiedSlots}건
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-oriwan-surface-light px-3 py-3">
                    <p className="text-[10px] font-black text-oriwan-text-muted">진행</p>
                    <p className="mt-1 text-xl font-black tracking-[-0.05em] text-oriwan-text">{dashboard.elapsedDays.length}/{CHALLENGE_DAYS}</p>
                  </div>
                  <div className="rounded-2xl bg-lime-300 px-3 py-3 text-slate-950">
                    <p className="text-[10px] font-black opacity-60">누적 인증률</p>
                    <p className="mt-1 text-xl font-black tracking-[-0.05em]">{dashboard.cumulativeRate}%</p>
                  </div>
                  <div className="rounded-2xl bg-oriwan-surface-light px-3 py-3">
                    <p className="text-[10px] font-black text-oriwan-text-muted">오늘 인증</p>
                    <p className="mt-1 text-xl font-black tracking-[-0.05em] text-oriwan-text">{dashboard.todayCertifiedIds.size}명</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[28px] bg-slate-950 p-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black">주차별 인증률</h4>
                      <p className="mt-1 text-[11px] font-semibold text-white/45">주마다 얼마나 꾸준히 인증했는지 보여줍니다.</p>
                    </div>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-lime-200 ring-1 ring-white/10">
                      평균 {dashboard.cumulativeRate}%
                    </span>
                  </div>

                  <div className="mt-5 flex h-36 items-end gap-1.5">
                    {dashboard.weekTrend.map((week) => (
                      <div key={`${week.from}-${week.to}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="flex h-28 w-full items-end rounded-2xl bg-white/5 p-1 ring-1 ring-white/5">
                          <div
                            className={`w-full rounded-xl ${week.averageRate ? "bg-lime-300" : "bg-white/15"}`}
                            style={{ height: `${Math.max(week.averageRate, week.averageRate ? 8 : 4)}%` }}
                            title={`${week.label} · 평균 ${week.averageRate}% · ${week.averageCount}명`}
                          />
                        </div>
                        <span className="text-[9px] font-black text-white/45">{week.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black text-oriwan-text">참가자별 꾸준함</h4>
                    <p className="text-[10px] font-black text-oriwan-text-muted">오늘 기준</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {dashboard.participantProgress.map((row) => (
                      <div key={row.participant.id} className="rounded-2xl bg-white px-3 py-2.5 ring-1 ring-slate-950/5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-black text-oriwan-text">{row.participant.name}</p>
                          <p className="shrink-0 text-[10px] font-black text-oriwan-text-muted">{row.certifiedDays}일 · {row.rate}%</p>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-oriwan-surface-light">
                          <div
                            className="h-full rounded-full bg-lime-300"
                            style={{ width: `${Math.max(row.rate, row.certifiedDays ? 4 : 0)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {!dashboard.participantProgress.length && !loading && (
                      <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-oriwan-text-muted md:col-span-2">
                        참가자를 추가하면 인증 흐름이 표시됩니다.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-3xl bg-rose-50 px-5 py-4 text-sm font-bold text-rose-900 ring-1 ring-rose-100">
            {error}
          </div>
        )}

        {data?.setup_required && (
          <div className="mt-4 rounded-3xl bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950 ring-1 ring-amber-100">
            아직 운영 데이터 테이블이 연결되지 않았어요. 관리자가 Supabase 스키마를 적용하면 참가자 현황이 바로 표시됩니다.
          </div>
        )}

        <YoutubeShortsSection />

        <p className="py-6 text-center text-[11px] font-semibold text-oriwan-text-muted">
          {loading ? "데이터를 불러오는 중..." : `마지막 업데이트 ${formatLastUpdated(data?.generated_at)}`}
        </p>
      </section>
    </main>
  );
}
