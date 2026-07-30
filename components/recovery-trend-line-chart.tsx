export type RecoveryTrendDatum = {
  date: string;
  count: number;
};

export type RecoverySignalMember = {
  name: string;
};

export type RecoverySignalMetrics = {
  targetCount: number;
  totalMembers: RecoverySignalMember[];
  recentMembers: RecoverySignalMember[];
  recentNewMembers: RecoverySignalMember[];
  repeatMembers: RecoverySignalMember[];
  consecutiveMembers: RecoverySignalMember[];
  recentDelta: number;
  recentWindowStart: string;
  recoveryEndDate: string;
};

function formatRecoveryDate(date: string) {
  const [, month, day] = date.split("-");
  if (!month || !day) return date;
  return `${month}.${day}`;
}

function RecoveryTrendPlot({
  data,
  width,
  height,
  idPrefix,
  className,
  labelStep = 7,
  compact = false,
}: {
  data: RecoveryTrendDatum[];
  width: number;
  height: number;
  idPrefix: string;
  className: string;
  labelStep?: number;
  compact?: boolean;
}) {
  const margin = compact
    ? { top: 18, right: 12, bottom: 42, left: 12 }
    : { top: 22, right: 18, bottom: 46, left: 18 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxCount = Math.max(1, ...data.map((item) => item.count));
  const gridValues = [1, 0.66, 0.33, 0];
  const labelIndexes = compact
    ? Array.from(new Set([
      0,
      data.length > 14 ? Math.floor((data.length - 1) / 2) : -1,
      data.length - 1,
    ])).filter((index) => index >= 0)
    : Array.from(new Set([
      0,
      ...data.map((_, index) => index).filter((index) => (
        index > 0 &&
        index % labelStep === 0 &&
        data.length - 1 - index >= 5
      )),
      data.length - 1,
    ])).filter((index) => index >= 0);
  const xAt = (index: number) => (
    data.length > 1
      ? margin.left + (index / (data.length - 1)) * plotWidth
      : margin.left + plotWidth / 2
  );
  const yAt = (count: number) => margin.top + plotHeight - (count / maxCount) * plotHeight;
  const points = data.map((item, index) => `${xAt(index)},${yAt(item.count)}`).join(" ");
  const areaPoints = data.length
    ? `${margin.left},${margin.top + plotHeight} ${points} ${width - margin.right},${margin.top + plotHeight}`
    : "";

  return (
    <svg
      role="img"
      aria-labelledby={`${idPrefix}-title ${idPrefix}-desc`}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
    >
      <title id={`${idPrefix}-title`}>전체 리커버리 추이</title>
      <desc id={`${idPrefix}-desc`}>
        {`챌린지 기간의 날짜별 리커버리 인증 흐름입니다. 인증이 없었던 날도 포함해 총 ${data.length}일을 표시합니다.`}
      </desc>
      <defs>
        <linearGradient id={`${idPrefix}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-oriwan-danger)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-oriwan-danger)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridValues.map((position) => {
        const y = margin.top + plotHeight * (1 - position);
        return (
          <line
            key={`${idPrefix}-grid-${position}`}
            x1={margin.left}
            y1={y}
            x2={width - margin.right}
            y2={y}
            stroke="rgba(148,163,184,0.2)"
            strokeWidth="1"
            strokeDasharray={position === 0 ? undefined : "4 5"}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      <polygon points={areaPoints} fill={`url(#${idPrefix}-area)`} />
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-oriwan-danger)"
        strokeWidth={compact ? "3.5" : "3"}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {labelIndexes.map((index) => {
        const item = data[index];
        if (!item) return null;
        const x = xAt(index);
        const y = yAt(item.count);
        const textAnchor = index === 0 ? "start" : index === data.length - 1 ? "end" : "middle";

        return (
          <g key={`${idPrefix}-point-${item.date}`}>
            <circle
              cx={x}
              cy={y}
              r={compact ? "3.5" : "4"}
              fill="var(--color-oriwan-danger)"
              stroke="white"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            >
              <title>{formatRecoveryDate(item.date)}</title>
            </circle>
            <line
              x1={x}
              y1={margin.top + plotHeight}
              x2={x}
              y2={margin.top + plotHeight + 4}
              stroke="rgba(100,116,139,0.35)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={x}
              y={height - 13}
              textAnchor={textAnchor}
              fill="rgba(71,85,105,0.78)"
              fontSize={compact ? "10.5" : "11"}
              fontWeight="800"
            >
              {formatRecoveryDate(item.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RecoveryTrendLineChart({
  data,
  idPrefix = "public-recovery-trend",
}: {
  data: RecoveryTrendDatum[];
  idPrefix?: string;
}) {
  return (
    <div className="rounded-[22px] bg-white px-3 py-4 ring-1 ring-slate-950/5 sm:px-5 sm:py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-oriwan-text">전체 리커버리 추이</h3>
          <p className="mt-1 text-[11px] font-bold leading-5 text-oriwan-text-muted sm:hidden">
            챌린지 기간의 날짜별 리커버리 흐름
          </p>
          <p className="mt-1 hidden max-w-2xl text-[11px] font-bold leading-5 text-oriwan-text-muted sm:block">
            챌린지 시작일부터 현재까지 각 날짜에 리커버리 인증을 완료한 고유 인원을 보여줍니다. 같은 날 여러 기록이 있어도 1명으로 계산하며 0명인 날짜도 포함합니다.
          </p>
        </div>
        <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-600">
          <span className="h-1.5 w-4 rounded-full bg-rose-500" aria-hidden="true" />
          인증 흐름
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-gradient-to-b from-rose-50/70 to-white ring-1 ring-rose-100/70 sm:mt-4">
        {data.length ? (
          <>
            <RecoveryTrendPlot
              data={data}
              width={420}
              height={205}
              idPrefix={`${idPrefix}-mobile`}
              className="block h-auto w-full sm:hidden"
              compact
            />
            <RecoveryTrendPlot
              data={data}
              width={860}
              height={260}
              idPrefix={`${idPrefix}-desktop`}
              className="hidden h-auto w-full sm:block"
            />
          </>
        ) : (
          <div className="rounded-2xl bg-oriwan-surface-light px-4 py-12 text-center">
            <p className="text-sm font-black text-oriwan-text">표시할 리커버리 인증 추이가 없어요.</p>
            <p className="mt-1 text-[11px] font-bold text-oriwan-text-muted">첫 인증이 완료되면 점과 수치가 바로 표시됩니다.</p>
          </div>
        )}
      </div>
      <p className="mt-2 hidden text-[10px] font-bold leading-4 text-oriwan-text-muted sm:block">
        가로축은 전체 챌린지 경과일, 선은 날짜별 당일 고유 인증 인원입니다. 모든 화면에서 전체 기간을 보여줍니다.
      </p>
    </div>
  );
}

const recoveryMetricTones = {
  rose: {
    surface: "bg-rose-50",
    value: "text-rose-600",
    badge: "bg-rose-100 text-rose-700",
    progress: "bg-rose-500",
    glow: "bg-rose-200/45",
  },
  blue: {
    surface: "bg-sky-50",
    value: "text-sky-700",
    badge: "bg-sky-100 text-sky-700",
    progress: "bg-sky-500",
    glow: "bg-sky-200/45",
  },
  amber: {
    surface: "bg-amber-50",
    value: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    progress: "bg-amber-400",
    glow: "bg-amber-200/45",
  },
  violet: {
    surface: "bg-violet-50",
    value: "text-violet-700",
    badge: "bg-violet-100 text-violet-700",
    progress: "bg-violet-500",
    glow: "bg-violet-200/45",
  },
  lime: {
    surface: "bg-lime-50",
    value: "text-lime-700",
    badge: "bg-lime-100 text-lime-800",
    progress: "bg-lime-500",
    glow: "bg-lime-200/50",
  },
} as const;

function ratioPercentage(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.min(Math.round((numerator / denominator) * 100), 100);
}

function RecoveryMetricCard({
  label,
  mobileLabel,
  eyebrow,
  value,
  percentage,
  description,
  mobileDescription,
  calculationLabel,
  deltaLabel,
  tone,
  large = false,
}: {
  label: string;
  mobileLabel?: string;
  eyebrow: string;
  value: number;
  percentage: number;
  description: string;
  mobileDescription?: string;
  calculationLabel: string;
  deltaLabel?: string;
  tone: keyof typeof recoveryMetricTones;
  large?: boolean;
}) {
  const safePercentage = Math.max(0, Math.min(percentage, 100));
  const toneStyle = recoveryMetricTones[tone];

  return (
    <article
      aria-label={`${label} ${value}명, 전체 대비 ${safePercentage}%`}
      className={`relative min-w-0 overflow-hidden rounded-[20px] p-3.5 ring-1 ring-slate-950/5 sm:rounded-[26px] ${large ? "min-h-[156px] sm:min-h-[210px] sm:p-6" : "min-h-[148px] sm:min-h-[190px] sm:p-5"} ${toneStyle.surface}`}
    >
      <span className={`pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full blur-2xl sm:h-32 sm:w-32 ${toneStyle.glow}`} aria-hidden="true" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-oriwan-text-muted sm:text-[10px]">{eyebrow}</p>
            <h3 className={`mt-0.5 font-black leading-tight text-oriwan-text sm:mt-1 ${large ? "text-[15px] sm:text-xl" : "text-[15px] sm:text-base"}`}>
              <span className="sm:hidden">{mobileLabel || label}</span>
              <span className="hidden sm:inline">{label}</span>
            </h3>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black sm:px-2.5 sm:py-1 sm:text-[10px] ${toneStyle.badge}`}>{safePercentage}%</span>
        </div>

        <div className={`flex min-w-0 flex-wrap items-end gap-1 ${large ? "mt-2.5 sm:mt-6" : "mt-2.5 sm:mt-5"}`}>
          <span className={`text-4xl font-black leading-none tracking-[-0.04em] ${large ? "sm:text-6xl" : ""} ${toneStyle.value}`}>{value}</span>
          <span className={`pb-0.5 text-base font-black text-oriwan-text sm:pb-1 ${large ? "sm:text-xl" : ""}`}>명</span>
          {deltaLabel && (
            <span className="mb-0.5 ml-1 max-w-full rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-black leading-4 text-oriwan-text-muted ring-1 ring-slate-950/5 sm:mb-1 sm:py-1 sm:text-[10px]">
              {deltaLabel}
            </span>
          )}
        </div>

        <p className="mt-1.5 break-keep text-[10px] font-bold leading-4 text-oriwan-text-muted sm:hidden">
          {mobileDescription || description}
        </p>
        <p className="mt-2 hidden break-keep text-[11px] font-bold leading-5 text-oriwan-text-muted sm:block">{description}</p>

        <div className="mt-auto pt-2 sm:pt-4">
          <div
            role="progressbar"
            aria-label={`${label} 전체 대비 ${safePercentage}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={safePercentage}
            className="h-1.5 overflow-hidden rounded-full bg-white/85 ring-1 ring-slate-950/5 sm:h-2"
          >
            <div className={`h-full rounded-full ${toneStyle.progress}`} style={{ width: `${Math.max(safePercentage, value ? 3 : 0)}%` }} />
          </div>
          <p className="mt-2 hidden text-[9px] font-black leading-4 text-oriwan-text-muted sm:block">{calculationLabel}</p>
        </div>
      </div>
    </article>
  );
}

export function RecoverySignalMetricsGrid({ metrics }: { metrics: RecoverySignalMetrics }) {
  const totalRatio = ratioPercentage(metrics.totalMembers.length, metrics.targetCount);
  const recentRatio = ratioPercentage(metrics.recentMembers.length, metrics.targetCount);
  const recentNewRatio = ratioPercentage(metrics.recentNewMembers.length, metrics.targetCount);
  const repeatRatio = ratioPercentage(metrics.repeatMembers.length, metrics.targetCount);
  const consecutiveRatio = ratioPercentage(metrics.consecutiveMembers.length, metrics.targetCount);

  return (
    <>
      <div className="mt-2.5 grid gap-2 sm:mt-3 md:grid-cols-2">
        <RecoveryMetricCard
          eyebrow="Cumulative"
          label="누적 리커버리"
          value={metrics.totalMembers.length}
          percentage={totalRatio}
          description={`전체 인증 대상 ${metrics.targetCount}명 중 한 번 이상 리커버리 인증을 한 고유 인원입니다.`}
          mobileDescription="한 번 이상 리커버리 인증한 고유 인원"
          calculationLabel="계산: 전체 기간 리커버리 고유 인원 ÷ 전체 인증 대상"
          tone="rose"
          large
        />
        <RecoveryMetricCard
          eyebrow="Last 7 Days"
          label="최근 7일 리커버리 인증 인원"
          mobileLabel="최근 7일 리커버리"
          value={metrics.recentMembers.length}
          percentage={recentRatio}
          description={`${formatRecoveryDate(metrics.recentWindowStart)}부터 ${formatRecoveryDate(metrics.recoveryEndDate)}까지 한 번 이상 인증한 고유 인원입니다.`}
          mobileDescription={`${formatRecoveryDate(metrics.recentWindowStart)}–${formatRecoveryDate(metrics.recoveryEndDate)} 인증 고유 인원`}
          calculationLabel="계산: 최근 7일 리커버리 고유 인원 ÷ 전체 인증 대상"
          deltaLabel={`${metrics.recentDelta >= 0 ? "+" : ""}${metrics.recentDelta}명 · 직전 7일 대비`}
          tone="blue"
          large
        />
      </div>

      <div className="mt-2 grid gap-2 min-[520px]:grid-cols-2 md:grid-cols-3">
        <RecoveryMetricCard
          eyebrow="New Signal"
          label="최근 7일 신규 리커버리"
          mobileLabel="최근 7일 신규"
          value={metrics.recentNewMembers.length}
          percentage={recentNewRatio}
          description="최근 7일 안에 처음으로 리커버리 인증을 시작한 인원입니다."
          mobileDescription="최근 7일에 처음 인증한 인원"
          calculationLabel="계산: 최초 리커버리 인증일이 최근 7일인 고유 인원"
          tone="lime"
        />
        <RecoveryMetricCard
          eyebrow="Repeat"
          label="반복 리커버리 인원"
          mobileLabel="반복 리커버리"
          value={metrics.repeatMembers.length}
          percentage={repeatRatio}
          description="전체 기간 동안 리커버리 인증을 총 3회 이상 한 인원입니다."
          mobileDescription="전체 기간 3회 이상 인증한 인원"
          calculationLabel="계산: 전체 기간 누적 리커버리 인증 3회 이상"
          tone="amber"
        />
        <RecoveryMetricCard
          eyebrow="Consecutive"
          label="연속 리커버리 인원"
          mobileLabel="연속 리커버리"
          value={metrics.consecutiveMembers.length}
          percentage={consecutiveRatio}
          description="전체 기간 중 리커버리 인증이 3일 이상 연속된 인원입니다."
          mobileDescription="3일 이상 연속으로 인증한 인원"
          calculationLabel="계산: 최장 연속 리커버리 인증 3일 이상"
          tone="violet"
        />
      </div>

      <div className="mt-2 rounded-[18px] bg-slate-950 px-3.5 py-3 text-white sm:mt-3 sm:rounded-[22px] sm:px-5 sm:py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Recovery Signal Guide</p>
            <p className="mt-1 break-keep text-[11px] font-black leading-4 text-white sm:text-sm sm:leading-6">
              <span className="sm:hidden">누적·최근·신규·반복·연속 신호를 함께 확인하세요.</span>
              <span className="hidden sm:inline">누적 규모는 상단에서, 최근 증가·신규·반복·연속 신호는 하단 3개 지표와 추이선에서 함께 확인하세요.</span>
            </p>
          </div>
          <span className="w-fit shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black text-lime-200 ring-1 ring-white/10">
            전체 대상 {metrics.targetCount}명
          </span>
        </div>
      </div>
    </>
  );
}
