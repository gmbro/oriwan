"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck } from "@/components/icons";
import { ScoreBadge } from "@/components/score-badge";
import { YoutubeShortsSection } from "@/components/youtube-shorts-section";
import { ACTUAL_CERTIFICATION_START_DATE, CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_END_DATE, CHALLENGE_START_DATE } from "@/lib/challenge";
import { addDays, toIsoDate } from "@/lib/run-records";
import { buildScoreRows } from "@/lib/scoring";

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

type CalendarRange = 14 | 30 | 100;

const today = toIsoDate(new Date());
const calendarRangeOptions: CalendarRange[] = [14, 30, 100];

function makeDays(count: number, startDate = CERTIFICATION_DISPLAY_START_DATE) {
  const endDate = today > CHALLENGE_END_DATE ? CHALLENGE_END_DATE : today;
  const rangeEnd = new Date(`${endDate}T00:00:00`);
  return Array.from({ length: count }, (_, index) => toIsoDate(addDays(rangeEnd, index - (count - 1))))
    .filter((day) => day >= startDate && day <= CHALLENGE_END_DATE);
}

function statusStyle(status: RunRecord["status"] | "missing" | "before_start") {
  if (status === "before_start") return "bg-slate-100/70 text-slate-300 ring-1 ring-slate-200/70";
  if (status === "certified") return "bg-lime-300 text-slate-950 shadow-sm shadow-lime-300/50";
  if (status === "needs_review") return "bg-orange-200 text-orange-950";
  if (status === "rejected") return "bg-rose-200 text-rose-950";
  return "bg-white/70 text-slate-300 ring-1 ring-slate-200";
}

function formatLastUpdated(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function certificationDayLabel() {
  const start = new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`);
  const current = new Date(`${today > CHALLENGE_END_DATE ? CHALLENGE_END_DATE : today}T00:00:00`);
  const diffDays = Math.floor((current.getTime() - start.getTime()) / 86_400_000);
  if (diffDays < 0) return `D-${Math.abs(diffDays)}`;
  return `D+${diffDays + 1}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<PublicDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [calendarRange, setCalendarRange] = useState<CalendarRange>(14);
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

  const calendarDays = useMemo(() => makeDays(calendarRange), [calendarRange]);

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
    records.forEach((record) => {
      if (record.participant_id && record.record_date) {
        byParticipantDate.set(`${record.participant_id}:${record.record_date}`, record);
      }
    });

    const scoreRows = buildScoreRows({
      participants,
      records,
      challengeStartDate: CHALLENGE_START_DATE,
      referenceDate: today > CHALLENGE_END_DATE ? CHALLENGE_END_DATE : today,
    });

    return {
      participants,
      records,
      scoreRows,
      byParticipantDate,
      todayCertifiedIds,
      completionRate,
    };
  }, [data]);

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
        <div className="relative overflow-hidden rounded-[30px] bg-[#101522] p-5 text-white shadow-2xl shadow-slate-950/10 sm:p-7">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-lime-300/25 blur-3xl" />
          <div className="absolute bottom-0 left-8 h-32 w-72 rounded-full bg-orange-400/15 blur-3xl" />
          <div className="relative grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-lime-200 ring-1 ring-white/10 sm:text-[11px]">
                  인증 기간 · {CERTIFICATION_DISPLAY_START_DATE} ~ {CHALLENGE_END_DATE}
                </p>
                <p className="inline-flex rounded-full bg-lime-300 px-3 py-1 text-[10px] font-black text-slate-950 sm:text-[11px]">
                  실제 인증 {certificationDayLabel()} · {ACTUAL_CERTIFICATION_START_DATE}부터
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

        <section className="mt-4 card overflow-hidden p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black tracking-[-0.03em] text-oriwan-text">인증 캘린더</h3>
              <p className="mt-1 text-xs text-oriwan-text-muted">참가자별 인증 여부</p>
            </div>
            <div className="flex rounded-full bg-oriwan-surface-light p-1 ring-1 ring-slate-950/5">
              {calendarRangeOptions.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setCalendarRange(days)}
                  className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                    calendarRange === days ? "bg-slate-950 text-lime-200 shadow-sm" : "text-oriwan-text-muted hover:text-oriwan-text"
                  }`}
                >
                  {days}일
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="space-y-2" style={{ minWidth: `${130 + calendarDays.length * 42}px` }}>
              <div
                className="grid gap-1 text-[10px] font-black text-oriwan-text-muted"
                style={{ gridTemplateColumns: `130px repeat(${calendarDays.length || 1}, minmax(34px, 1fr))` }}
              >
                <div>참가자</div>
                {calendarDays.map((day) => <div key={day} className="text-center">{day.slice(5).replace("-", "/")}</div>)}
              </div>
              {dashboard.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="grid items-center gap-1"
                  style={{ gridTemplateColumns: `130px repeat(${calendarDays.length || 1}, minmax(34px, 1fr))` }}
                >
                  <div className="truncate text-xs font-black text-oriwan-text">{participant.name}</div>
                  {calendarDays.map((day) => {
                    const record = dashboard.byParticipantDate.get(`${participant.id}:${day}`);
                    const status = day < CHALLENGE_START_DATE ? "before_start" : record?.status || "missing";
                    return (
                      <div
                        key={day}
                        title={`${participant.name} · ${day} · ${status === "before_start" ? "집계 전" : status === "certified" ? "인증 완료" : status === "needs_review" ? "확인 필요" : "미제출"}`}
                        className={`flex h-8 items-center justify-center rounded-xl text-[11px] font-black ${statusStyle(status)}`}
                      >
                        {status === "certified" ? <IconCheck size={13} /> : status === "needs_review" ? "!" : status === "before_start" ? "-" : "·"}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black tracking-[-0.03em] text-oriwan-text">러닝보드</h3>
              <p className="mt-1 text-xs text-oriwan-text-muted">점수순 · 동점은 가나다순</p>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-black text-lime-200">{dashboard.scoreRows.length}명</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.scoreRows.map((row, index) => (
              <div key={row.participant.id} className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-2 rounded-2xl bg-oriwan-surface-light px-3 py-2">
                <span className="text-xs font-black text-oriwan-primary">{index + 1}</span>
                <span className="truncate text-sm font-black text-oriwan-text">{row.participant.name}</span>
                <ScoreBadge kind={row.badgeKind} />
                <span className="text-sm font-black tabular-nums text-oriwan-text">{row.score}점</span>
              </div>
            ))}
            {!dashboard.scoreRows.length && !loading && <p className="py-8 text-center text-sm text-oriwan-text-muted sm:col-span-2 lg:col-span-3">아직 표시할 기록이 없습니다.</p>}
          </div>
        </section>

        <YoutubeShortsSection />

        <p className="py-6 text-center text-[11px] font-semibold text-oriwan-text-muted">
          {loading ? "데이터를 불러오는 중..." : `마지막 업데이트 ${formatLastUpdated(data?.generated_at)}`}
        </p>
      </section>
    </main>
  );
}
