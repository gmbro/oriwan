"use client";

import { useCallback, useEffect, useId, useState } from "react";

import type {
  PersonalCalendarDay,
  PersonalCumulativeDistancePoint,
  PersonalRecordsPayload,
  PersonalRunRecord,
  PersonalWeeklyProgress,
} from "@/lib/personal-records";

type LoadState = "loading" | "ready" | "error";

const STATUS_LABEL: Record<PersonalRunRecord["status"], string> = {
  certified: "인증 완료",
  needs_review: "검수 중",
  missing: "정보 보완",
  rejected: "인증 제외",
};

const CALENDAR_LABEL: Record<PersonalCalendarDay["state"], string> = {
  future: "예정",
  missed: "미인증",
  review: "검수 중",
  certified: "인증 완료",
  recovery: "리커버리 인증",
};

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function formatDistance(value: number) {
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}km`;
}

function formatDuration(seconds: number) {
  if (!seconds) return "0분";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}분`;
  return minutes ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

function formatPace(seconds: number | null) {
  if (!seconds) return "-";
  return `${Math.floor(seconds / 60)}'${String(seconds % 60).padStart(2, "0")}\"`;
}

function phaseLabel(payload: PersonalRecordsPayload) {
  if (payload.season.phase === "preseason") return "9월 23일 시작";
  if (payload.season.phase === "complete") return "100일 완주";
  return `${payload.season.elapsedOfficialDays}일차`;
}

export function PersonalRecordsDashboard() {
  const [state, setState] = useState<LoadState>("loading");
  const [payload, setPayload] = useState<PersonalRecordsPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadRecords = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    try {
      const response = await fetch("/api/me/records", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "개인 기록을 불러오지 못했어요.");
      setPayload(body as PersonalRecordsPayload);
      setState("ready");
    } catch (error) {
      setPayload(null);
      setErrorMessage(error instanceof Error ? error.message : "개인 기록을 불러오지 못했어요.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadRecords());
  }, [loadRecords]);

  if (state === "loading") return <PersonalRecordsSkeleton />;

  if (state === "error" || !payload) {
    return (
      <section className="mt-6 rounded-[28px] bg-white p-5 ring-1 ring-slate-200 sm:p-7" aria-labelledby="personal-records-error-title">
        <p className="text-xs font-black tracking-[0.12em] text-blue-600">MY RUN</p>
        <h2 id="personal-records-error-title" className="mt-2 text-xl font-black text-slate-950">기록을 불러오지 못했어요</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{errorMessage}</p>
        <button type="button" onClick={() => void loadRecords()} className="mt-4 min-h-11 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white">
          다시 불러오기
        </button>
      </section>
    );
  }

  const official = payload.summary.official;
  const preseason = payload.summary.preseason;
  const hasPreseasonRecords = payload.records.some((record) => record.phase === "preseason");

  return (
    <section className="mt-6 space-y-4" aria-labelledby="personal-records-title">
      <div className="rounded-[30px] bg-slate-950 p-5 text-white sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[0.12em] text-lime-300">MY RUN · 4TH</p>
            <h2 id="personal-records-title" className="mt-2 text-2xl font-black sm:text-3xl">나의 러닝 기록</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
              9월 23일부터 공식 100일 기록을 계산해요. 그 전에 남긴 러닝은 이 개인 화면에서만 따로 보여드려요.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-lime-200 ring-1 ring-white/10">
            {phaseLabel(payload)}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <SummaryMetric label="공식 인증" value={`${official.certifiedDays}일`} detail={`${payload.season.elapsedOfficialDays}/${payload.season.totalDays}일 경과`} />
          <SummaryMetric label="공식 인증률" value={official.certificationRate === null ? "시작 전" : `${official.certificationRate}%`} detail="시즌 전 기록 제외" />
          <SummaryMetric label="공식 누적 거리" value={formatDistance(official.totalDistanceKm)} detail={`러닝 ${formatDuration(official.totalDurationSeconds)}`} />
          <SummaryMetric label="현재 연속 기록" value={`${official.currentStreak}일`} detail={`최장 ${official.longestStreak}일 · 평균 ${formatPace(official.averagePaceSecondsPerKm)}/km`} />
        </dl>
      </div>

      {(payload.season.phase === "preseason" || hasPreseasonRecords) ? (
        <section className="rounded-[26px] bg-slate-100 p-5 ring-1 ring-slate-200 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6" aria-labelledby="preseason-records-title">
          <div>
            <p className="text-xs font-black tracking-[0.1em] text-slate-500">PERSONAL ONLY</p>
            <h3 id="preseason-records-title" className="mt-1 text-lg font-black text-slate-950">시즌 전 기록</h3>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-500">공식 인증률, D-day, 크루 통계에는 포함되지 않아요.</p>
          </div>
          {preseason.certifiedDays > 0 ? (
            <dl className="mt-4 grid grid-cols-3 gap-2 sm:mt-0 sm:min-w-[360px]">
              <MiniMetric label="러닝" value={`${preseason.certifiedDays}일`} />
              <MiniMetric label="거리" value={formatDistance(preseason.totalDistanceKm)} />
              <MiniMetric label="시간" value={formatDuration(preseason.totalDurationSeconds)} />
            </dl>
          ) : (
            <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-slate-500 sm:mt-0">아직 시즌 전 개인 기록이 없어요.</p>
          )}
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <CumulativeDistanceChart points={payload.series.cumulativeDistance} payload={payload} />
        <WeeklyBars weeks={payload.series.weekly} seasonPhase={payload.season.phase} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <HundredDayCalendar days={payload.series.calendar} today={payload.season.today} />
        <RecentRecords records={payload.records} />
      </div>
    </section>
  );
}

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
      <dt className="text-xs font-black text-slate-400">{label}</dt>
      <dd className="mt-1 text-xl font-black text-white sm:text-2xl">{value}</dd>
      <dd className="mt-1 text-xs font-bold leading-5 text-slate-400">{detail}</dd>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-3 text-center ring-1 ring-slate-200">
      <dt className="text-xs font-black text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-black text-slate-800">{value}</dd>
    </div>
  );
}

function PersonalRecordsSkeleton() {
  return (
    <section className="mt-6 space-y-4" aria-label="개인 러닝 기록을 불러오는 중" aria-busy="true">
      <div className="h-64 animate-pulse rounded-[30px] bg-slate-900" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-[28px] bg-slate-100" />
        <div className="h-64 animate-pulse rounded-[28px] bg-slate-100" />
      </div>
    </section>
  );
}

function CumulativeDistanceChart({
  points,
  payload,
}: {
  points: PersonalCumulativeDistancePoint[];
  payload: PersonalRecordsPayload;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const width = 720;
  const height = 230;
  const padding = { left: 48, right: 18, top: 28, bottom: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const startMs = Date.parse(`${payload.season.personalRecordStartDate}T00:00:00Z`);
  const visibleEnd = payload.season.today < payload.season.startDate
    ? payload.season.startDate
    : payload.season.today > payload.season.endDate
      ? payload.season.endDate
      : payload.season.today;
  const endMs = Date.parse(`${visibleEnd}T00:00:00Z`);
  const rangeMs = Math.max(86_400_000, endMs - startMs);
  const maxDistance = Math.max(1, ...points.map((point) => point.cumulativeKm));
  const x = (date: string) => padding.left + ((Date.parse(`${date}T00:00:00Z`) - startMs) / rangeMs) * plotWidth;
  const y = (distance: number) => padding.top + plotHeight - (distance / maxDistance) * plotHeight;
  const phasePoints = (phase: PersonalCumulativeDistancePoint["phase"]) => points
    .filter((point) => point.phase === phase)
    .map((point) => `${x(point.date).toFixed(1)},${y(point.cumulativeKm).toFixed(1)}`)
    .join(" ");
  const startMarkerX = x(payload.season.startDate);
  const certifiedPoints = points.filter((point) => point.cumulativeKm > 0);

  return (
    <figure className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200 sm:p-6">
      <figcaption>
        <p className="text-xs font-black tracking-[0.1em] text-blue-600">DISTANCE</p>
        <h3 className="mt-1 text-lg font-black text-slate-950">누적 거리 흐름</h3>
        <p className="mt-1 text-xs font-bold text-slate-500">시즌 전과 공식 시즌 누적값을 각각 0km부터 계산해요.</p>
      </figcaption>

      {certifiedPoints.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <svg className="min-w-[540px] snap-start" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
            <title id={titleId}>개인 누적 거리 그래프</title>
            <desc id={descriptionId}>회색선은 시즌 전 개인 기록, 파란선은 9월 23일부터 계산한 공식 기록입니다.</desc>
            {[0, 0.5, 1].map((ratio) => (
              <g key={ratio}>
                <line x1={padding.left} x2={width - padding.right} y1={padding.top + plotHeight * ratio} y2={padding.top + plotHeight * ratio} stroke="#e2e8f0" strokeWidth="1" />
                <text x={padding.left - 8} y={padding.top + plotHeight * ratio + 4} textAnchor="end" fontSize="12" fontWeight="700" fill="#64748b">
                  {(maxDistance * (1 - ratio)).toFixed(maxDistance >= 10 ? 0 : 1)}
                </text>
              </g>
            ))}
            <line x1={startMarkerX} x2={startMarkerX} y1={padding.top - 8} y2={height - padding.bottom} stroke="#2563eb" strokeDasharray="4 5" strokeWidth="1.5" />
            <text x={Math.min(startMarkerX + 6, width - 90)} y={padding.top - 12} fontSize="12" fontWeight="800" fill="#2563eb">9.23 공식 시작</text>
            {phasePoints("preseason") ? <polyline points={phasePoints("preseason")} fill="none" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null}
            {phasePoints("official") ? <polyline points={phasePoints("official")} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null}
            {certifiedPoints.map((point) => (
              <circle key={`${point.phase}-${point.date}`} cx={x(point.date)} cy={y(point.cumulativeKm)} r="4" fill={point.phase === "official" ? "#2563eb" : "#94a3b8"} stroke="white" strokeWidth="2">
                <title>{formatShortDate(point.date)} · {point.phase === "official" ? "공식" : "시즌 전"} 누적 {formatDistance(point.cumulativeKm)}</title>
              </circle>
            ))}
            <text x={padding.left} y={height - 8} fontSize="12" fontWeight="700" fill="#64748b">{formatShortDate(payload.season.personalRecordStartDate)}</text>
            <text x={width - padding.right} y={height - 8} textAnchor="end" fontSize="12" fontWeight="700" fill="#64748b">{formatShortDate(visibleEnd)}</text>
          </svg>
        </div>
      ) : (
        <ChartEmptyState message="첫 인증이 쌓이면 누적 거리 흐름이 나타나요." />
      )}

      <div className="mt-3 flex flex-wrap gap-4 text-xs font-black text-slate-500" aria-hidden="true">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-slate-400" />시즌 전 개인 기록</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-blue-600" />공식 100일 기록</span>
      </div>
    </figure>
  );
}

function WeeklyBars({ weeks, seasonPhase }: { weeks: PersonalWeeklyProgress[]; seasonPhase: PersonalRecordsPayload["season"]["phase"] }) {
  const maxDistance = Math.max(1, ...weeks.map((week) => week.distanceKm));
  return (
    <figure className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200 sm:p-6">
      <figcaption>
        <p className="text-xs font-black tracking-[0.1em] text-blue-600">WEEKLY</p>
        <h3 className="mt-1 text-lg font-black text-slate-950">공식 주간 거리</h3>
        <p className="mt-1 text-xs font-bold text-slate-500">9월 23일부터 100일을 15개 주차로 나눠요.</p>
      </figcaption>
      {seasonPhase === "preseason" ? (
        <p className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-xs font-black text-blue-700">공식 시즌이 시작되면 주간 막대가 채워져요.</p>
      ) : null}
      <ol className="mt-5 grid snap-x grid-flow-col auto-cols-[46px] gap-2 overflow-x-auto pb-3" aria-label="공식 주차별 러닝 거리">
        {weeks.map((week) => {
          const barHeight = week.distanceKm > 0 ? Math.max(8, (week.distanceKm / maxDistance) * 100) : 3;
          return (
            <li key={week.weekNumber} className="flex min-h-[168px] snap-start flex-col items-center justify-end" aria-label={`${week.weekNumber}주차, ${formatShortDate(week.from)}부터 ${formatShortDate(week.to)}, 인증 ${week.certifiedDays}일, 거리 ${formatDistance(week.distanceKm)}`}>
              <span className="mb-1 text-xs font-black text-slate-500">{week.distanceKm > 0 ? week.distanceKm.toFixed(1) : ""}</span>
              <span className="flex h-28 w-7 items-end overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <span className={`w-full rounded-full ${week.elapsedDays > 0 ? "bg-blue-600" : "bg-slate-200"}`} style={{ height: `${barHeight}%` }} />
              </span>
              <span className="mt-2 text-xs font-black text-slate-400">{week.weekNumber}주</span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

function HundredDayCalendar({ days, today }: { days: PersonalCalendarDay[]; today: string }) {
  return (
    <section className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200 sm:p-6" aria-labelledby="hundred-day-calendar-title">
      <p className="text-xs font-black tracking-[0.1em] text-blue-600">100 DAYS</p>
      <h3 id="hundred-day-calendar-title" className="mt-1 text-lg font-black text-slate-950">100일 인증 캘린더</h3>
      <p className="mt-1 text-xs font-bold text-slate-500">한 칸이 하루예요. 시즌 전 기록은 이 캘린더에 섞이지 않아요.</p>
      <ol className="mt-5 grid grid-cols-10 gap-1.5" aria-label="9월 23일부터 12월 31일까지 공식 인증 현황">
        {days.map((day) => (
          <li key={day.date}>
            <span
              className={`block aspect-square rounded-[7px] ring-1 ${calendarClass(day.state)} ${day.date === today ? "ring-2 ring-slate-950 ring-offset-1" : "ring-transparent"}`}
              role="img"
              aria-label={`${day.dayNumber}일차 ${formatShortDate(day.date)}, ${CALENDAR_LABEL[day.state]}${day.date === today ? ", 오늘" : ""}`}
              title={`${day.dayNumber}일차 · ${formatShortDate(day.date)} · ${CALENDAR_LABEL[day.state]}`}
            />
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-black text-slate-500" aria-hidden="true">
        <CalendarLegend className="bg-blue-600" label="인증" />
        <CalendarLegend className="bg-lime-400" label="리커버리" />
        <CalendarLegend className="bg-amber-300" label="검수 중" />
        <CalendarLegend className="bg-rose-100" label="미인증" />
        <CalendarLegend className="bg-slate-100" label="예정" />
      </div>
    </section>
  );
}

function calendarClass(state: PersonalCalendarDay["state"]) {
  if (state === "certified") return "bg-blue-600";
  if (state === "recovery") return "bg-lime-400";
  if (state === "review") return "bg-amber-300";
  if (state === "missed") return "bg-rose-100";
  return "bg-slate-100";
}

function CalendarLegend({ className, label }: { className: string; label: string }) {
  return <span className="flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-[3px] ${className}`} />{label}</span>;
}

function RecentRecords({ records }: { records: PersonalRunRecord[] }) {
  return (
    <section className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200 sm:p-6" aria-labelledby="recent-personal-records-title">
      <p className="text-xs font-black tracking-[0.1em] text-blue-600">RECENT</p>
      <h3 id="recent-personal-records-title" className="mt-1 text-lg font-black text-slate-950">최근 기록</h3>
      {records.length > 0 ? (
        <ol className="mt-4 divide-y divide-slate-100">
          {records.slice(0, 8).map((record) => (
            <li key={record.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <time dateTime={record.date} className="text-sm font-black text-slate-900">{formatShortDate(record.date)}</time>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black ${record.phase === "preseason" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700"}`}>
                      {record.phase === "preseason" ? "개인 전용" : "공식 시즌"}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black ${record.status === "certified" ? "bg-lime-100 text-lime-800" : "bg-amber-100 text-amber-800"}`}>
                      {record.isRecovery && record.status === "certified" ? "리커버리" : STATUS_LABEL[record.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                    {record.status === "certified"
                      ? `${record.distanceKm === null ? "거리 -" : formatDistance(record.distanceKm)} · ${record.durationSeconds === null ? "시간 -" : formatDuration(record.durationSeconds)}`
                      : record.status === "needs_review"
                        ? record.phase === "preseason"
                          ? "검수가 끝나면 개인 준비 기록에 반영돼요."
                          : "검수가 끝나면 공식 통계에 반영돼요."
                        : record.status === "rejected"
                          ? "반려된 기록이라 통계에서 제외됐어요."
                          : "인증되지 않은 기록이라 통계에서 제외됐어요."}
                  </p>
                </div>
                {record.status === "certified" && !record.isRecovery ? (
                  <span className="shrink-0 text-xs font-black text-slate-500">{formatPace(record.paceSecondsPerKm)}/km</span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <ChartEmptyState message="아직 등록된 개인 러닝 기록이 없어요." />
      )}
    </section>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="mt-5 flex min-h-32 items-center justify-center rounded-2xl bg-slate-50 px-5 text-center text-xs font-black leading-5 text-slate-400">
      {message}
    </div>
  );
}
