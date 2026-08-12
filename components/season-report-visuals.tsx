import type { SeasonReportCalendarMonth, SeasonReportMonth, SeasonReportWeek } from "@/lib/season-report";

export function SeasonWeeklyLineChart({
  weeks,
  accent = "#84cc16",
}: {
  weeks: SeasonReportWeek[];
  accent?: string;
}) {
  const width = 600;
  const height = 160;
  const paddingX = 24;
  const paddingTop = 18;
  const paddingBottom = 28;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;
  const bestRate = Math.max(...weeks.map((week) => week.rate), 0);
  const bestWeekIndex = weeks.findIndex((week) => week.rate === bestRate);
  const points = weeks.map((week, index) => {
    const x = weeks.length === 1 ? width / 2 : paddingX + (index / (weeks.length - 1)) * plotWidth;
    const y = paddingTop + ((100 - week.rate) / 100) * plotHeight;
    return { x, y, week, index };
  });
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label={`15주간 인증률 꺾은선 그래프, 최고 ${bestRate}%`}
    >
      {[0, 50, 100].map((rate) => {
        const y = paddingTop + ((100 - rate) / 100) * plotHeight;
        return <line key={rate} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
      })}
      <path d={path} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.map((point) => {
        const isBest = point.index === bestWeekIndex;
        const isEdge = point.index === 0 || point.index === points.length - 1;
        if (!isBest && !isEdge) return null;
        return (
          <g key={point.week.label}>
            <circle cx={point.x} cy={point.y} r={isBest ? 6 : 4} fill={isBest ? "#0f172a" : "#ffffff"} stroke={accent} strokeWidth="3" />
            {isBest && (
              <text x={point.x} y={Math.max(point.y - 12, 11)} textAnchor="middle" fontSize="10" fontWeight="900" fill="#0f172a">
                {point.week.rate}%
              </text>
            )}
          </g>
        );
      })}
      {points.map((point) => (
        (point.index === 0 || point.index === bestWeekIndex || point.index === points.length - 1) && (
          <text key={`label-${point.week.label}`} x={point.x} y={height - 5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#64748b">
            {point.week.label}
          </text>
        )
      ))}
    </svg>
  );
}

export function SeasonWeeklyBars({
  weeks,
  accent = "#bef264",
  compact = false,
}: {
  weeks: SeasonReportWeek[];
  accent?: string;
  compact?: boolean;
}) {
  const maxValue = Math.max(...weeks.map((week) => week.rate), 1);
  const bestWeekIndex = weeks.findIndex((week) => week.rate === maxValue);
  return (
    <div className={`flex w-full min-w-0 items-end overflow-hidden ${compact ? "h-24 gap-1" : "h-32 gap-1.5"}`} aria-label="주간 인증률 그래프">
      {weeks.map((week, index) => {
        const isBest = index === bestWeekIndex;
        return (
          <div key={week.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            {isBest && <span className="text-[8px] font-black text-current">{week.rate}%</span>}
            <span
              className="w-full min-w-1 rounded-full bg-current transition-all"
              style={{ height: `${Math.max(week.rate, 4)}%`, color: isBest ? accent : `${accent}66` }}
              title={`${week.label} ${week.rate}%`}
            />
            {(index === 0 || index === weeks.length - 1 || isBest) && (
              <span className="whitespace-nowrap text-[8px] font-black opacity-55">{week.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SeasonMonthlyBars({ months, accent = "#bef264" }: { months: SeasonReportMonth[]; accent?: string }) {
  return (
    <div className="grid grid-cols-4 gap-2" aria-label="월간 인증률 그래프">
      {months.map((month) => (
        <div key={month.key} className="min-w-0">
          <div className="mb-1.5 flex items-end justify-between gap-1">
            <span className="whitespace-nowrap text-[9px] font-black opacity-60 sm:text-[10px]">{month.label}</span>
            <span className="whitespace-nowrap text-[11px] font-black sm:text-xs">{month.rate}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-current/10">
            <div className="h-full rounded-full" style={{ width: `${month.rate}%`, backgroundColor: accent }} />
          </div>
          <p className="mt-1 whitespace-nowrap text-[7px] font-bold opacity-50 sm:text-[8px]">{month.certifiedDays}/{month.targetDays}일</p>
        </div>
      ))}
    </div>
  );
}

export function SeasonMonthlyDistanceBars({
  months,
  accent = "#38bdf8",
}: {
  months: SeasonReportMonth[];
  accent?: string;
}) {
  const maxDistance = Math.max(...months.map((month) => month.distanceKm), 1);
  return (
    <div className="flex h-full min-h-0 items-end gap-3" aria-label="월별 총 거리 그래프">
      {months.map((month) => {
        const height = Math.max((month.distanceKm / maxDistance) * 100, 5);
        return (
          <div key={month.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[8px] font-black tabular-nums text-slate-500 sm:text-[10px]">{month.distanceKm.toFixed(0)}</span>
            <span
              className="w-full max-w-12 rounded-t-[6px]"
              style={{ height: `${height}%`, backgroundColor: accent }}
              title={`${month.label} 총 거리 ${month.distanceKm.toFixed(1)}km`}
            />
            <span className="mt-1 text-[8px] font-black text-slate-400 sm:text-[10px]">{month.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SeasonCalendar({ months }: { months: SeasonReportCalendarMonth[] }) {
  return (
    <div className="grid grid-cols-2 gap-3" aria-label="월별 인증 날짜">
      {months.map((month) => (
        <section key={month.key} className="min-w-0 rounded-2xl bg-white/8 p-2.5 ring-1 ring-white/10">
          <p className="mb-2 text-[10px] font-black opacity-70">{month.label}</p>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: month.leadingBlankCount }, (_, index) => <span key={`blank-${index}`} />)}
            {month.cells.map((cell) => (
              <span
                key={cell.date}
                title={`${cell.date} ${cell.status === "certified" ? "본 인증" : cell.status === "recovery" ? "리커버리 인증" : "미인증"}`}
                className={`relative flex aspect-square min-w-0 items-center justify-center rounded-[5px] text-[7px] font-black ${
                  cell.status === "certified"
                    ? "bg-lime-300 text-slate-950"
                    : cell.status === "recovery"
                      ? "bg-sky-300 text-sky-950"
                      : "bg-white/10 text-white/35"
                }`}
              >
                {cell.day}
                {cell.badgeEarned && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-300 ring-1 ring-slate-950/20" />}
              </span>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function SeasonCalendarLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold opacity-70">
      <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-[3px] bg-lime-300" />본 인증</span>
      <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-[3px] bg-sky-300" />리커버리</span>
      <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-[3px] bg-white/15" />미인증</span>
      <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-300" />뱃지 획득</span>
    </div>
  );
}
