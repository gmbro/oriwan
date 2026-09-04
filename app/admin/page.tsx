"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { TwttBrandMark } from "@/components/twtt-brand-mark";
import { AdminContentWorkspace } from "@/components/admin-content-workspace";
import { AdminProfileIntroductions } from "@/components/admin-profile-introductions";
import { IconCalendar, IconCheck, IconRun, IconSync, IconTarget, IconTrash, IconX } from "@/components/icons";
import { buildMemberPictogramMap, MemberPictogram } from "@/components/member-pictogram";
import {
  FOURTH_SEASON_DAYS as CHALLENGE_DAYS,
  FOURTH_SEASON_START_DATE as ACTUAL_CERTIFICATION_START_DATE,
  FOURTH_SEASON_START_DATE as CHALLENGE_START_DATE,
  clampToFourthSeasonWindow as clampToChallengeWindow,
} from "@/lib/fourth-season-contract";
import { broadcastDashboardRefresh } from "@/lib/dashboard-refresh";
import { imageFileToOptimizedDataUrl } from "@/lib/image-client";
import { PARTICIPANT_RANK_SORT_OPTIONS, type ParticipantRankSortMode, sortParticipantRanks } from "@/lib/participant-ranking";
import {
  RECOVERY_CERTIFICATION_DISTANCE_KM,
  RECOVERY_CERTIFICATION_DURATION_SECONDS,
  RECOVERY_CERTIFICATION_NOTE,
  RECOVERY_CERTIFICATION_OVERRIDE_OFF_NOTE,
  RECOVERY_CERTIFICATION_SOURCE,
  addDays,
  formatKstTime,
  hasRecoveryCertificationOverrideOffText,
  hasRecoveryCertificationText,
  isCertificationCountedStatus,
  isRecoveryCertificationRecord,
  parseDurationToSeconds,
  secondsToTime,
  toIsoDate,
  toKstIsoDate,
} from "@/lib/run-records";

type Participant = {
  id: string;
  name: string;
  nickname: string | null;
  active: boolean;
  display_order: number;
};

type RecordStatus = "certified" | "needs_review" | "missing" | "rejected";
type AnalysisStatus = RecordStatus | "duplicate";

type RunRecord = {
  id: string;
  participant_id: string | null;
  record_date: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  pace_seconds_per_km: number | null;
  source_app: string | null;
  status: RecordStatus;
  confidence_score: number | null;
  image_url: string | null;
  raw_extracted_text: string | null;
  notes: string | null;
  created_at: string | null;
  participants?: { id: string; name: string } | null;
};

type AnalysisResult = {
  id: string | null;
  file_name: string;
  participant_id?: string | null;
  participant_name?: string | null;
  record_date?: string | null;
  distance_km?: number | null;
  duration_seconds?: number | null;
  status?: AnalysisStatus;
  notes?: string | null;
  edit_distance?: string;
  edit_duration?: string;
  duplicate?: boolean;
};

type PendingAnalyzeImage = {
  name: string;
  dataUrl: string;
};

const IMAGE_PREP_CONCURRENCY = 6;

async function preparePendingAnalyzeImages(files: File[], onProgress: (completed: number) => void) {
  const results = new Array<PendingAnalyzeImage>(files.length);
  let nextIndex = 0;
  let completed = 0;
  const workerCount = Math.min(IMAGE_PREP_CONCURRENCY, Math.max(1, files.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < files.length) {
      const index = nextIndex;
      nextIndex += 1;
      const file = files[index];
      results[index] = { name: file.name, dataUrl: await imageFileToOptimizedDataUrl(file) };
      completed += 1;
      onProgress(completed);
    }
  }));

  return results;
}

function MemberPicker({
  participants,
  value,
  onChange,
  placeholder = "멤버 선택",
  disabled = false,
}: {
  participants: Participant[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedParticipant = participants.find((participant) => participant.id === value) || null;

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-oriwan-border bg-white px-3.5 py-3 text-left text-base font-black text-oriwan-text outline-none transition focus:border-oriwan-primary disabled:opacity-50"
      >
        <span className={`min-w-0 truncate ${selectedParticipant ? "text-oriwan-text" : "text-oriwan-text-muted"}`}>
          {selectedParticipant?.name || placeholder}
        </span>
        <span className="shrink-0 text-sm font-black text-oriwan-text-muted" aria-hidden="true">v</span>
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[120] max-h-72 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-2xl shadow-slate-950/20 ring-1 ring-slate-950/10">
          <button
            type="button"
            onClick={() => selectValue("")}
            className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-base font-black ${
              !value ? "bg-blue-500 text-white" : "text-oriwan-text hover:bg-oriwan-surface-light"
            }`}
          >
            {placeholder}
          </button>
          {participants.map((participant) => (
            <button
              key={participant.id}
              type="button"
              onClick={() => selectValue(participant.id)}
              className={`mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-left text-base font-black ${
                value === participant.id ? "bg-blue-500 text-white" : "text-oriwan-text hover:bg-oriwan-surface-light"
              }`}
            >
              <span className="truncate">{participant.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type AdminModal = "participant" | "record" | "upload" | "participantRecords" | null;
type AdminTab = "certifications" | "crew" | "encouragements" | "banners" | "comments";

const ADMIN_TABS: ReadonlyArray<{ key: AdminTab; label: string }> = [
  { key: "certifications", label: "인증" },
  { key: "crew", label: "크루프로필" },
  { key: "encouragements", label: "응원글" },
  { key: "banners", label: "배너" },
  { key: "comments", label: "댓글" },
];

function isAdminTab(value: string | null): value is AdminTab {
  return ADMIN_TABS.some((tab) => tab.key === value);
}

function getInitialAdminTab(): AdminTab {
  if (typeof window === "undefined") return "certifications";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return isAdminTab(tab) ? tab : "certifications";
}

const IMAGE_UPLOAD_CHUNK_SIZE = 20;
const MAX_BATCH_IMAGE_FILES = 20;
const now = new Date();
const today = toKstIsoDate(now);
const effectiveToday = today;
const officialCertificationEndDate = toIsoDate(addDays(new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`), CHALLENGE_DAYS - 1));
const initialRecordDate = clampToChallengeWindow(today);
const initialUploadDate = clampToChallengeWindow(today);
const rangeStart = CHALLENGE_START_DATE;

function statusLabel(status: AnalysisStatus) {
  if (status === "duplicate") return "이미 인증됨";
  if (status === "certified") return "완료";
  if (status === "needs_review") return "확인 중";
  if (status === "missing") return "보류";
  if (status === "rejected") return "반려";
  return "아직";
}

function statusClass(status: AnalysisStatus) {
  if (status === "duplicate") return "bg-slate-100 text-slate-700 border-slate-200";
  if (status === "certified") return "bg-lime-100 text-lime-900 border-lime-200";
  if (status === "needs_review") return "bg-orange-100 text-orange-900 border-orange-200";
  if (status === "missing") return "bg-slate-100 text-slate-700 border-slate-200";
  if (status === "rejected") return "bg-rose-100 text-rose-900 border-rose-200";
  return "bg-slate-100 text-slate-400 border-slate-200";
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

function getImageFiles(fileList: FileList | File[]) {
  return Array.from(fileList).filter((file) => file.type.startsWith("image/"));
}

function getImageFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function getAnalysisResultKey(result: AnalysisResult, index: number) {
  return result.id || `${result.file_name}-${index}`;
}

function formatFileSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)}KB`;
  return `${bytes}B`;
}

function formatAdminDate(date: string | null | undefined) {
  if (!date) return "날짜 미정";
  const [, month, day] = date.split("-");
  if (!month || !day) return date;
  return `${month}.${day}`;
}

function formatAdminFullDate(date: string) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;

  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "Asia/Seoul" })
    .format(new Date(`${date}T00:00:00+09:00`));
  return `${year}.${month}.${day} ${weekday}`;
}

function inclusiveDateCount(from: string, to: string) {
  if (to < from) return 0;
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((toTime - fromTime) / 86_400_000) + 1;
}

function ratioPercentage(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.min(Math.round((numerator / denominator) * 100), 100);
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

function formatCompactMemberNames(members: Array<{ name: string }>) {
  if (!members.length) return "해당 인원 없음";
  const visibleNames = members.slice(0, 3).map((member) => member.name).join(", ");
  return members.length > 3 ? `${visibleNames} 외 ${members.length - 3}명` : visibleNames;
}

function formatDistanceInput(value: number | null | undefined) {
  return value ? String(value) : "";
}

function formatDurationInput(value: number | null | undefined) {
  return value ? secondsToTime(value) : "";
}

function hydrateAnalysisResult(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    edit_distance: result.edit_distance ?? formatDistanceInput(result.distance_km),
    edit_duration: result.edit_duration ?? formatDurationInput(result.duration_seconds),
  };
}

function nextRecordNotesForStatus(status: RecordStatus, record: {
  notes?: string | null;
  raw_extracted_text?: string | null;
  source_app?: string | null;
}) {
  if (status !== "certified") return record.notes ?? null;
  if (hasRecoveryCertificationOverrideOffText(record.notes)) return record.notes ?? null;
  if (isRecoveryCertificationRecord(record)) return record.notes || RECOVERY_CERTIFICATION_NOTE;
  return null;
}

function splitRecordNotes(notes: string | null | undefined) {
  return (notes || "")
    .split(" / ")
    .map((note) => note.trim())
    .filter(Boolean);
}

function isRecoveryNoteFragment(note: string) {
  return note === RECOVERY_CERTIFICATION_OVERRIDE_OFF_NOTE || hasRecoveryCertificationText(note);
}

function formatVisibleRecordNotes(notes: string | null | undefined) {
  return splitRecordNotes(notes)
    .filter((note) => note !== RECOVERY_CERTIFICATION_OVERRIDE_OFF_NOTE)
    .join(" / ");
}

function nextRecoveryRecordNotes(notes: string | null | undefined, recoveryEnabled: boolean) {
  const nonRecoveryNotes = splitRecordNotes(notes).filter((note) => !isRecoveryNoteFragment(note));
  const nextNotes = recoveryEnabled
    ? [RECOVERY_CERTIFICATION_NOTE, ...nonRecoveryNotes]
    : [...nonRecoveryNotes, RECOVERY_CERTIFICATION_OVERRIDE_OFF_NOTE];

  return nextNotes.join(" / ") || null;
}

function nextRecoverySourceApp(sourceApp: string | null | undefined, recoveryEnabled: boolean) {
  if (recoveryEnabled) return RECOVERY_CERTIFICATION_SOURCE;
  if (sourceApp === RECOVERY_CERTIFICATION_SOURCE || sourceApp === RECOVERY_CERTIFICATION_NOTE) return null;
  return sourceApp || null;
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

function RecoveryMetricCard({
  label,
  eyebrow,
  value,
  unit,
  percentage,
  description,
  calculationLabel,
  membersLabel,
  deltaLabel,
  tone,
  large = false,
}: {
  label: string;
  eyebrow: string;
  value: number;
  unit: string;
  percentage: number;
  description: string;
  calculationLabel: string;
  membersLabel?: string;
  deltaLabel?: string;
  tone: keyof typeof recoveryMetricTones;
  large?: boolean;
}) {
  const safePercentage = Math.max(0, Math.min(percentage, 100));
  const toneStyle = recoveryMetricTones[tone];

  return (
    <article
      aria-label={`${label} ${value}${unit}, 전체 대비 ${safePercentage}%`}
      className={`relative min-w-0 overflow-hidden rounded-[26px] p-4 ring-1 ring-slate-950/5 ${large ? "min-h-[210px] sm:p-6" : "min-h-[190px] sm:p-5"} ${toneStyle.surface}`}
    >
      <span className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-2xl ${toneStyle.glow}`} aria-hidden="true" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-oriwan-text-muted">{eyebrow}</p>
            <h3 className={`mt-1 font-black leading-tight text-oriwan-text ${large ? "text-lg sm:text-xl" : "text-base"}`}>{label}</h3>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${toneStyle.badge}`}>{safePercentage}%</span>
        </div>

        <div className={`flex items-end gap-1 ${large ? "mt-6" : "mt-5"}`}>
          <span className={`font-black leading-none tracking-[-0.04em] ${large ? "text-5xl sm:text-6xl" : "text-4xl"} ${toneStyle.value}`}>{value}</span>
          <span className={`pb-1 font-black text-oriwan-text ${large ? "text-xl" : "text-base"}`}>{unit}</span>
          {deltaLabel && (
            <span className="mb-1 ml-1 rounded-full bg-white/80 px-2 py-1 text-[10px] font-black text-oriwan-text-muted ring-1 ring-slate-950/5">
              {deltaLabel}
            </span>
          )}
        </div>

        <p className="mt-2 break-keep text-[11px] font-bold leading-5 text-oriwan-text-muted">{description}</p>
        {membersLabel && (
          <p className="mt-1.5 truncate text-[11px] font-black text-oriwan-text">{membersLabel}</p>
        )}

        <div className="mt-auto pt-4">
          <div
            role="progressbar"
            aria-label={`${label} 전체 대비 ${safePercentage}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={safePercentage}
            className="h-2 overflow-hidden rounded-full bg-white/85 ring-1 ring-slate-950/5"
          >
            <div className={`h-full rounded-full ${toneStyle.progress}`} style={{ width: `${Math.max(safePercentage, value ? 3 : 0)}%` }} />
          </div>
          <p className="mt-2 text-[9px] font-black leading-4 text-oriwan-text-muted">{calculationLabel}</p>
        </div>
      </div>
    </article>
  );
}

type RecoveryTrendDatum = { date: string; count: number };

function RecoveryTrendPlot({
  data,
  width,
  height,
  idPrefix,
  className,
  labelStep = 7,
}: {
  data: RecoveryTrendDatum[];
  width: number;
  height: number;
  idPrefix: string;
  className: string;
  labelStep?: number;
}) {
  const margin = { top: 48, right: 22, bottom: 54, left: 46 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxCount = Math.max(1, ...data.map((item) => item.count));
  const tickValues = maxCount <= 5
    ? Array.from({ length: maxCount + 1 }, (_, index) => maxCount - index)
    : Array.from(new Set([maxCount, Math.round((maxCount * 2) / 3), Math.round(maxCount / 3), 0])).sort((a, b) => b - a);
  const labelIndexes = Array.from(new Set([
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

  return (
    <svg
      role="img"
      aria-labelledby={`${idPrefix}-title ${idPrefix}-desc`}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
    >
      <title id={`${idPrefix}-title`}>전체 리커버리 추이 · 일별 고유 인원</title>
      <desc id={`${idPrefix}-desc`}>
        {`각 날짜에 리커버리 인증을 완료한 고유 인원 추이를 표시합니다. 인증이 없었던 날도 포함한 총 ${data.length}일의 흐름입니다.`}
      </desc>
      <line
        x1={margin.left}
        y1={margin.top}
        x2={margin.left}
        y2={margin.top + plotHeight}
        stroke="rgba(15,23,42,0.28)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {tickValues.map((tick) => {
        const y = yAt(tick);
        return (
          <g key={`${idPrefix}-y-${tick}`}>
            <line
              x1={margin.left}
              y1={y}
              x2={width - margin.right}
              y2={y}
              stroke="rgba(15,23,42,0.12)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={margin.left - 10}
              y={y + 4}
              textAnchor="end"
              fill="rgba(71,85,105,0.82)"
              fontSize="12"
              fontWeight="800"
            >
              {tick}명
            </text>
          </g>
        );
      })}
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-oriwan-danger)"
        strokeWidth="3"
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
            <text
              x={x}
              y={y - 13}
              textAnchor="middle"
              fill="var(--color-oriwan-danger)"
              fontSize="13"
              fontWeight="900"
            >
              {item.count}명
            </text>
            <rect
              x={x - 4.5}
              y={y - 4.5}
              width="9"
              height="9"
              rx="2"
              fill="var(--color-oriwan-danger)"
            >
              <title>{`${formatAdminFullDate(item.date)} · ${item.count}명`}</title>
            </rect>
            <line
              x1={x}
              y1={margin.top + plotHeight}
              x2={x}
              y2={margin.top + plotHeight + 5}
              stroke="rgba(15,23,42,0.38)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={x}
              y={height - 15}
              textAnchor={textAnchor}
              fill="rgba(71,85,105,0.88)"
              fontSize="11"
              fontWeight="800"
            >
              {formatAdminDate(item.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RecoveryTrendLineChart({ data }: { data: RecoveryTrendDatum[] }) {
  const desktopData = data;
  const mobileData = data;
  const peak = data.reduce<RecoveryTrendDatum | null>((currentPeak, item) => (
    !currentPeak || item.count > currentPeak.count ? item : currentPeak
  ), null);
  const latest = data[data.length - 1] || null;

  return (
    <div className="rounded-[22px] bg-white px-3 py-4 ring-1 ring-slate-950/5 sm:px-5 sm:py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-black text-oriwan-text">전체 리커버리 추이</h3>
          <p className="mt-1 max-w-2xl text-[11px] font-bold leading-5 text-oriwan-text-muted">
            챌린지 시작일부터 현재까지 각 날짜에 리커버리 인증을 완료한 고유 인원을 보여줍니다. 같은 날 여러 기록이 있어도 1명으로 계산하며 0명인 날짜도 포함합니다.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800">
            하루 최고 {peak?.count || 0}명{peak && peak.count > 0 ? ` · ${formatAdminDate(peak.date)}` : ""}
          </span>
          <span className="rounded-full bg-lime-100 px-2.5 py-1 text-[10px] font-black text-lime-800">
            최근 일자 {latest?.count || 0}명{latest ? ` · ${formatAdminDate(latest.date)}` : ""}
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-white">
        {data.length ? (
          <>
            <RecoveryTrendPlot
              data={mobileData}
              width={420}
              height={290}
              idPrefix="recovery-trend-mobile"
              className="block h-auto w-full sm:hidden"
              labelStep={14}
            />
            <RecoveryTrendPlot
              data={desktopData}
              width={860}
              height={280}
              idPrefix="recovery-trend-desktop"
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
      <p className="mt-2 text-[10px] font-bold leading-4 text-oriwan-text-muted">
        가로축은 전체 챌린지 경과일, 선은 날짜별 당일 고유 인증 인원입니다. 모든 화면에서 전체 기간을 보여주며 정확한 인증자는 아래 목록에서 확인할 수 있습니다.
      </p>
    </div>
  );
}

function RecoveryParticipantBarChart({
  data,
}: {
  data: Array<{
    id: string;
    name: string;
    count: number;
    maxConsecutive: number;
    symptomStartDate: string | null;
    recoveryCompleteDate: string | null;
  }>;
}) {
  const maxCount = Math.max(1, ...data.map((item) => item.count));

  return (
    <div className="rounded-[22px] bg-white px-4 py-4 ring-1 ring-slate-950/5 sm:px-5 sm:py-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-black text-oriwan-text">사용자별 누적 리커버리 인증일</h3>
          <p className="mt-1 max-w-2xl text-[11px] font-bold leading-5 text-oriwan-text-muted">
            막대는 누적 인증일을 비교합니다. 날짜 라벨은 최신 리커버리 구간의 첫날과 이후 첫 일반 인증일을 기준으로 추정합니다.
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-black text-sky-800">
          기준 최고 {data[0]?.count || 0}일
        </span>
      </div>

      {data.length ? (
        <div className="mt-4 grid gap-x-6 gap-y-3 lg:grid-cols-2">
          {data.map((item) => (
            <div key={item.id} className="rounded-2xl bg-oriwan-surface-light/70 px-3 py-3 ring-1 ring-slate-950/5">
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.75rem] items-center gap-2">
                <span className="truncate text-xs font-black text-oriwan-text">{item.name}</span>
                <div
                  role="progressbar"
                  aria-label={`${item.name} 누적 리커버리 인증 ${item.count}일`}
                  aria-valuemin={0}
                  aria-valuemax={maxCount}
                  aria-valuenow={item.count}
                  className="h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-950/5"
                >
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${Math.max(4, (item.count / maxCount) * 100)}%` }}
                  />
                </div>
                <span className="text-right text-xs font-black text-amber-700">{item.count}일</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-oriwan-text-muted ring-1 ring-slate-950/5">
                  증상 시작일 {formatAdminDate(item.symptomStartDate)}
                </span>
                <span className={`rounded-full px-2 py-1 text-[9px] font-black ring-1 ${
                  item.recoveryCompleteDate
                    ? "bg-white text-oriwan-text-muted ring-slate-950/5"
                    : "bg-rose-50 text-rose-700 ring-rose-200"
                }`}>
                  회복완료일 {item.recoveryCompleteDate ? formatAdminDate(item.recoveryCompleteDate) : "진행 중"}
                </span>
                {item.maxConsecutive >= 3 && (
                  <span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-black text-violet-700 ring-1 ring-violet-200">
                    최장 {item.maxConsecutive}일 연속
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-oriwan-surface-light px-4 py-7 text-center text-xs font-bold text-oriwan-text-muted">
          리커버리 인증이 쌓이면 사용자별 누적 막대가 표시됩니다.
        </p>
      )}
    </div>
  );
}

function AdminActionButton({
  title,
  meta,
  icon,
  variant = "dark",
  onClick,
}: {
  title: string;
  meta: string;
  icon: ReactNode;
  variant?: "primary" | "dark";
  onClick: () => void;
}) {
  const isPrimary = variant === "primary";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[74px] items-center justify-between gap-3 rounded-[22px] px-4 py-3 text-left transition hover:-translate-y-0.5 ${
        isPrimary
          ? "bg-lime-300 text-slate-950 shadow-lg shadow-lime-300/20"
          : "bg-white/10 text-white ring-1 ring-white/10 hover:bg-white/[0.14]"
      }`}
    >
      <span className="min-w-0">
        <span className={`block text-[11px] font-black ${isPrimary ? "text-slate-950/60" : "text-white/50"}`}>{meta}</span>
        <span className="mt-1 block text-sm font-black leading-tight">{title}</span>
      </span>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-105 ${
        isPrimary ? "bg-slate-950 text-lime-200" : "bg-white text-slate-950"
      }`}>
        {icon}
      </span>
    </button>
  );
}

type ParticipantLoginAccount = {
  auth_user_id: string;
  display_name: string;
  email: string;
  created_at: string;
  participant_id: string | null;
  status: "unlinked" | "pending" | "approved" | "revoked";
  approved_at: string | null;
  display_name_override: string;
};

function ParticipantAccountManager({ participants }: { participants: Participant[] }) {
  const [accounts, setAccounts] = useState<ParticipantLoginAccount[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [realNames, setRealNames] = useState<Record<string, string>>({});
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [savingAccountId, setSavingAccountId] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  const loadAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/participant-accounts", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) {
        setAccountMessage(json.error || "카카오 계정 목록을 불러오지 못했어요.");
        return;
      }
      const nextAccounts = (json.accounts || []) as ParticipantLoginAccount[];
      setAccounts(nextAccounts);
      setSelections((current) => Object.fromEntries(nextAccounts.map((account) => [
        account.auth_user_id,
        current[account.auth_user_id] || account.participant_id || "",
      ])));
      setRealNames((current) => Object.fromEntries(nextAccounts.map((account) => {
        const participantName = participants.find((participant) => participant.id === account.participant_id)?.name || "";
        return [account.auth_user_id, current[account.auth_user_id] || account.display_name_override || participantName];
      })));
      setAccountMessage("");
    } catch {
      setAccountMessage("카카오 계정 목록을 불러오지 못했어요.");
    } finally {
      setLoadingAccounts(false);
    }
  }, [participants]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadAccounts();
    });
  }, [loadAccounts]);

  const updateAccount = async (account: ParticipantLoginAccount, status: "approved" | "revoked") => {
    const participantId = status === "revoked"
      ? account.participant_id || ""
      : selections[account.auth_user_id] || account.participant_id || "";
    if (!participantId) {
      setAccountMessage("연결할 크루를 먼저 선택해주세요.");
      return;
    }
    setSavingAccountId(account.auth_user_id);
    setAccountMessage("");
    try {
      const response = await fetch("/api/admin/participant-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_user_id: account.auth_user_id,
          participant_id: participantId,
          status,
          display_name_override: realNames[account.auth_user_id] || "",
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        setAccountMessage(json.error || "카카오 계정 연결을 저장하지 못했어요.");
        return;
      }
      setAccountMessage(status === "approved" ? "카카오 계정을 크루와 연결했어요." : "카카오 계정 연결을 해제했어요.");
      await loadAccounts();
    } catch {
      setAccountMessage("카카오 계정 연결을 저장하지 못했어요.");
    } finally {
      setSavingAccountId("");
    }
  };

  return (
    <section className="mt-6 rounded-[24px] bg-slate-950 p-4 text-white sm:p-5" aria-labelledby="kakao-account-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase text-[#FEE500]">Kakao account approval</p>
          <h3 id="kakao-account-title" className="mt-1 text-lg font-black">카카오 계정 연결</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-white/55">같은 이름만으로 자동 연결하지 않고, 로그인 계정과 실제 크루를 직접 확인해 승인합니다.</p>
        </div>
        <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-white/70">{accounts.length}개 계정</span>
      </div>

      {accountMessage ? <p className="mt-4 rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold" role="status">{accountMessage}</p> : null}
      <div className="mt-4 grid gap-2">
        {loadingAccounts ? <p className="rounded-2xl bg-white/8 px-4 py-6 text-center text-xs font-bold text-white/55">로그인 계정을 불러오는 중…</p> : null}
        {!loadingAccounts && !accounts.length ? <p className="rounded-2xl bg-white/8 px-4 py-6 text-center text-xs font-bold text-white/55">아직 카카오로 로그인한 계정이 없습니다.</p> : null}
        {accounts.map((account) => (
          <article key={account.auth_user_id} className="grid gap-3 rounded-[20px] bg-white/8 p-3 ring-1 ring-white/10 xl:grid-cols-[minmax(0,1fr)_minmax(11rem,0.75fr)_minmax(11rem,0.75fr)_auto] xl:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="truncate text-sm">{account.display_name}</strong>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${account.status === "approved" ? "bg-lime-300 text-slate-950" : account.status === "revoked" ? "bg-rose-400/20 text-rose-200" : "bg-white/10 text-white/60"}`}>
                  {account.status === "approved" ? "연결 완료" : account.status === "revoked" ? "연결 해제" : "미연결"}
                </span>
              </div>
              <p className="mt-1 truncate text-[10px] font-semibold text-white/45">{account.email || account.auth_user_id}</p>
            </div>
            <label className="text-[10px] font-black text-white/50">
              연결할 크루
              <select
                value={selections[account.auth_user_id] || ""}
                onChange={(event) => {
                  const participantId = event.target.value;
                  const participantName = participants.find((participant) => participant.id === participantId)?.name || "";
                  setSelections((current) => ({ ...current, [account.auth_user_id]: participantId }));
                  setRealNames((current) => ({ ...current, [account.auth_user_id]: participantName || current[account.auth_user_id] || "" }));
                }}
                className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-white px-3 text-sm font-black text-slate-950"
              >
                <option value="">크루 선택</option>
                {participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-black text-white/50">
              댓글에 표시할 이름
              <input
                value={realNames[account.auth_user_id] || ""}
                maxLength={40}
                onChange={(event) => setRealNames((current) => ({ ...current, [account.auth_user_id]: event.target.value }))}
                placeholder="운영자 확인 이름"
                className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-white px-3 text-sm font-black text-slate-950"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 lg:flex">
              <button type="button" onClick={() => void updateAccount(account, "approved")} disabled={savingAccountId === account.auth_user_id} className="min-h-11 rounded-xl bg-[#FEE500] px-4 text-xs font-black text-[#191919] disabled:opacity-50">승인 연결</button>
              <button type="button" onClick={() => void updateAccount(account, "revoked")} disabled={savingAccountId === account.auth_user_id || account.status !== "approved"} className="min-h-11 rounded-xl bg-white/10 px-4 text-xs font-black text-white disabled:opacity-30">연결 해제</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminWorkspacePanel({
  tab,
  participants,
  onOpenCrew,
}: {
  tab: Exclude<AdminTab, "certifications">;
  participants: Participant[];
  onOpenCrew: () => void;
}) {
  if (tab === "crew") {
    return (
      <section className="card mobile-page-card overflow-hidden p-4 sm:p-6" aria-labelledby="crew-admin-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase text-blue-600">Crew profile</p>
            <h2 id="crew-admin-title" className="mt-1 text-2xl font-black text-oriwan-text">크루프로필</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-oriwan-text-muted">크루 기본 정보와 4기 공개 자기소개를 관리합니다. 카카오 계정은 이름 자동 매칭 없이 운영자가 확인한 뒤 승인해야 해요.</p>
          </div>
          <button type="button" onClick={onOpenCrew} className="btn-primary min-h-12 shrink-0 px-5 text-sm">크루 등록·수정</button>
        </div>
        <AdminProfileIntroductions />
        <div className="mt-6">
          <p className="text-[11px] font-black uppercase text-slate-500">Legacy internal note</p>
          <h3 className="mt-1 text-lg font-black text-oriwan-text">기존 내부 메모</h3>
          <p className="mt-1 break-keep text-xs font-semibold leading-5 text-oriwan-text-muted">기존 참가자 정보와 함께 보관하는 운영 메모입니다. 4기 대시보드에 공개되는 소개의 원본은 위 ‘4기 공개 자기소개’입니다.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {participants.map((participant) => (
            <button key={participant.id} type="button" onClick={onOpenCrew} className="rounded-[22px] bg-oriwan-surface-light p-4 text-left ring-1 ring-slate-950/5 transition hover:bg-white hover:shadow-lg">
              <p className="text-base font-black text-oriwan-text">{participant.name}</p>
              <p className="mt-1 text-[11px] font-black text-slate-500">기존 내부 메모</p>
              <p className="mt-1 line-clamp-2 min-h-10 text-xs font-semibold leading-5 text-oriwan-text-muted">{participant.nickname || "저장된 내부 메모가 없습니다."}</p>
            </button>
          ))}
          {!participants.length ? <p className="rounded-[22px] bg-oriwan-surface-light p-6 text-sm font-bold text-oriwan-text-muted">등록된 크루가 없습니다.</p> : null}
        </div>
        <ParticipantAccountManager participants={participants} />
      </section>
    );
  }

  return <AdminContentWorkspace tab={tab} />;
}

export default function AdminPage() {
  const router = useRouter();
  const loadInFlightRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [targetDate, setTargetDate] = useState(initialUploadDate);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadParticipantId, setUploadParticipantId] = useState("");
  const [uploadNewName, setUploadNewName] = useState("");
  const [addingUploadParticipant, setAddingUploadParticipant] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [updatingAnalysisKey, setUpdatingAnalysisKey] = useState("");
  const [updatingRecordId, setUpdatingRecordId] = useState("");
  const [manualParticipantId, setManualParticipantId] = useState("");
  const [manualDate, setManualDate] = useState(initialRecordDate);
  const [manualDistance, setManualDistance] = useState("");
  const [manualDuration, setManualDuration] = useState("");
  const [selectedRecordsParticipantId, setSelectedRecordsParticipantId] = useState("");
  const [recordDrafts, setRecordDrafts] = useState<Record<string, { distance: string; duration: string }>>({});
  const [liveStatus, setLiveStatus] = useState<"polling" | "syncing">("polling");
  const [setupMessage, setSetupMessage] = useState("");
  const [adminModal, setAdminModal] = useState<AdminModal>(null);
  const [editingParticipantId, setEditingParticipantId] = useState("");
  const [deletingRecordId, setDeletingRecordId] = useState("");
  const [participantSortMode, setParticipantSortMode] = useState<ParticipantRankSortMode>("certification");
  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialAdminTab);

  const loadData = useCallback(async (showLoading = true) => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const [participantsRes, recordsRes] = await Promise.all([
        fetch("/api/participants", { cache: "no-store" }),
        fetch(`/api/records?from=${rangeStart}&to=${effectiveToday}`, { cache: "no-store" }),
      ]);

      const participantsJson = await participantsRes.json();
      const recordsJson = await recordsRes.json();
      if ([participantsRes.status, recordsRes.status].some((status) => status === 401 || status === 403)) {
        setAuthorized(false);
        setParticipants([]);
        setRecords([]);
        setAuthMessage("관리자 이메일 인증이 필요해요.");
        setSetupMessage("");
        return;
      }
      if (participantsJson.setup_required || recordsJson.setup_required) {
        setSetupMessage("데이터 저장소 연결이 아직 준비되지 않았어요. Supabase SQL Editor에서 docs/supabase-schema.sql을 먼저 실행해주세요.");
      } else {
        setSetupMessage("");
      }
      if (!participantsRes.ok && !participantsJson.setup_required) throw new Error(participantsJson.error || "멤버 목록을 불러오지 못했어요.");
      if (!recordsRes.ok && !recordsJson.setup_required) throw new Error(recordsJson.error || "러닝 기록을 불러오지 못했어요.");
      const nextParticipants = participantsJson.participants || [];
      const nextRecords = recordsJson.records || [];

      setParticipants(nextParticipants);
      setRecords(nextRecords);
      setManualParticipantId((current) => current || nextParticipants[0]?.id || "");
    } catch (err) {
      setSetupMessage(err instanceof Error ? err.message : "데이터를 불러오지 못했어요. 잠시 후 다시 확인해주세요.");
    } finally {
      loadInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, []);

  const refreshAfterMutation = useCallback(async (showLoading = true) => {
    void broadcastDashboardRefresh();
    await loadData(showLoading);
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (cancelled) return;

      if (!response.ok) {
        setAuthorized(false);
        setAuthMessage(typeof json.error === "string" ? json.error : "관리자 이메일 인증이 필요해요.");
        setAuthReady(true);
        setLoading(false);
        return;
      }

      setAuthorized(true);
      setUserName(json.user?.name || "운영자");
      setUserAvatar(json.user?.avatar || "");
      await loadData();
      setAuthReady(true);
    };
    queueMicrotask(() => {
      if (!cancelled) setMounted(true);
      void init();
    });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const selectAdminTab = useCallback((tab: AdminTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (!mounted || !authorized) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setLiveStatus("syncing");
        void loadData(false).finally(() => setLiveStatus("polling"));
      }
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, [authorized, loadData, mounted]);

  const participantPictogramById = useMemo(() => buildMemberPictogramMap(participants), [participants]);
  const certificationParticipants = participants;
  const certificationParticipantIds = useMemo(
    () => new Set(certificationParticipants.map((participant) => participant.id)),
    [certificationParticipants]
  );

  const participantProgress = useMemo(() => {
    const certifiedDaysByParticipant = new Map<string, Set<string>>();
    const metricsByParticipant = new Map<string, { distanceKm: number; durationSeconds: number }>();
    const recoveryUsageByParticipant = new Map<string, number>();
    records.forEach((record) => {
      if (
        !isCertificationCountedStatus(record.status) ||
        !record.participant_id ||
        !certificationParticipantIds.has(record.participant_id) ||
        !record.record_date ||
        record.record_date < ACTUAL_CERTIFICATION_START_DATE ||
        record.record_date > officialCertificationEndDate
      ) return;
      if (!certifiedDaysByParticipant.has(record.participant_id)) certifiedDaysByParticipant.set(record.participant_id, new Set());
      certifiedDaysByParticipant.get(record.participant_id)?.add(record.record_date);
      const metrics = metricsByParticipant.get(record.participant_id) || { distanceKm: 0, durationSeconds: 0 };
      metrics.distanceKm += record.distance_km || 0;
      metrics.durationSeconds += record.duration_seconds || 0;
      metricsByParticipant.set(record.participant_id, metrics);
      if (isRecoveryCertificationRecord(record)) {
        recoveryUsageByParticipant.set(record.participant_id, (recoveryUsageByParticipant.get(record.participant_id) || 0) + 1);
      }
    });

    return certificationParticipants
      .map((participant) => {
        const certifiedDays = certifiedDaysByParticipant.get(participant.id)?.size || 0;
        const rate = Math.min(Math.round((certifiedDays / CHALLENGE_DAYS) * 100), 100);
        const metrics = metricsByParticipant.get(participant.id) || { distanceKm: 0, durationSeconds: 0 };
        return {
          participant,
          pictogramIndex: participantPictogramById.get(participant.id) ?? 0,
          certifiedDays,
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
  }, [certificationParticipantIds, certificationParticipants, participantPictogramById, records]);
  const sortedParticipantProgress = useMemo(
    () => sortParticipantRanks(participantProgress, participantSortMode),
    [participantProgress, participantSortMode]
  );
  const adminStats = useMemo(() => {
    const todayCertifiedIds = new Set<string>();
    let reviewCount = 0;
    let totalDistanceKm = 0;
    let totalDurationSeconds = 0;

    records.forEach((record) => {
      const isCertificationTargetRecord = !record.participant_id || certificationParticipantIds.has(record.participant_id);
      if (record.status === "needs_review" && isCertificationTargetRecord) reviewCount += 1;
      if (!isCertificationCountedStatus(record.status)) return;
      if (!record.participant_id || !certificationParticipantIds.has(record.participant_id)) return;
      if (record.record_date === effectiveToday) todayCertifiedIds.add(record.participant_id);
      if (
        record.record_date &&
        record.record_date >= ACTUAL_CERTIFICATION_START_DATE &&
        record.record_date <= officialCertificationEndDate
      ) {
        totalDistanceKm += record.distance_km || 0;
        totalDurationSeconds += record.duration_seconds || 0;
      }
    });

    return {
      todayCertifiedCount: todayCertifiedIds.size,
      todayRate: certificationParticipants.length ? Math.round((todayCertifiedIds.size / certificationParticipants.length) * 100) : 0,
      reviewCount,
      totalDistanceKm,
      totalDurationSeconds,
    };
  }, [certificationParticipantIds, certificationParticipants.length, records]);

  const todayMissingParticipants = useMemo(() => {
    const todayCertifiedIds = new Set<string>();

    records.forEach((record) => {
      if (
        record.record_date === effectiveToday &&
        record.participant_id &&
        certificationParticipantIds.has(record.participant_id) &&
        isCertificationCountedStatus(record.status)
      ) {
        todayCertifiedIds.add(record.participant_id);
      }
    });

    return certificationParticipants.filter((participant) => !todayCertifiedIds.has(participant.id));
  }, [certificationParticipantIds, certificationParticipants, records]);

  const reviewRecords = useMemo(() => {
    return records
      .filter((record) => (
        record.status === "needs_review" &&
        (!record.participant_id || certificationParticipantIds.has(record.participant_id))
      ))
      .map((record) => ({
        record,
        participantName: record.participants?.name ||
          participants.find((participant) => participant.id === record.participant_id)?.name ||
          "멤버 미지정",
      }))
      .sort((a, b) => (
        (b.record.record_date || "").localeCompare(a.record.record_date || "") ||
        (b.record.created_at || "").localeCompare(a.record.created_at || "") ||
        b.record.id.localeCompare(a.record.id)
      ));
  }, [certificationParticipantIds, participants, records]);

  const recoveryCertificationSummary = useMemo(() => {
    const participantById = new Map(participants.map((participant) => [participant.id, participant]));
    const affectedParticipantIds = new Set<string>();
    const participantsByDate = new Map<string, Map<string, { id: string; name: string; displayOrder: number }>>();
    const recoveryEndDate = effectiveToday < officialCertificationEndDate ? effectiveToday : officialCertificationEndDate;
    const elapsedDays = inclusiveDateCount(ACTUAL_CERTIFICATION_START_DATE, recoveryEndDate);

    records.forEach((record) => {
      if (
        !record.participant_id ||
        !record.record_date ||
        !certificationParticipantIds.has(record.participant_id) ||
        !isCertificationCountedStatus(record.status) ||
        record.record_date < ACTUAL_CERTIFICATION_START_DATE ||
        record.record_date > recoveryEndDate ||
        !isRecoveryCertificationRecord(record)
      ) return;

      const participant = participantById.get(record.participant_id);
      const participantName = participant?.name || record.participants?.name || "이름 미확인";
      const dailyParticipants = participantsByDate.get(record.record_date) || new Map();

      dailyParticipants.set(record.participant_id, {
        id: record.participant_id,
        name: participantName,
        displayOrder: participant?.display_order ?? Number.MAX_SAFE_INTEGER,
      });
      participantsByDate.set(record.record_date, dailyParticipants);
      affectedParticipantIds.add(record.participant_id);
    });

    const rows = Array.from(participantsByDate, ([date, dailyParticipants]) => ({
      date,
      participants: Array.from(dailyParticipants.values()).sort((a, b) => (
        a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "ko")
      )),
    })).sort((a, b) => b.date.localeCompare(a.date));

    const totalParticipants = affectedParticipantIds.size;
    const totalCertifications = rows.reduce((total, row) => total + row.participants.length, 0);
    const dailyDates = Array.from({ length: elapsedDays }, (_, index) => (
      toIsoDate(addDays(new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`), index))
    ));
    const dailyTrend = dailyDates.map((date) => ({
      date,
      count: participantsByDate.get(date)?.size || 0,
    }));
    const certifiedTimelineByParticipant = new Map<string, Map<string, boolean>>();

    records.forEach((record) => {
      if (
        !record.participant_id ||
        !record.record_date ||
        !affectedParticipantIds.has(record.participant_id) ||
        !isCertificationCountedStatus(record.status) ||
        record.record_date < ACTUAL_CERTIFICATION_START_DATE ||
        record.record_date > recoveryEndDate
      ) return;

      const timeline = certifiedTimelineByParticipant.get(record.participant_id) || new Map<string, boolean>();
      timeline.set(record.record_date, Boolean(timeline.get(record.record_date)) || isRecoveryCertificationRecord(record));
      certifiedTimelineByParticipant.set(record.participant_id, timeline);
    });

    const participantBarMap = new Map<string, {
      id: string;
      name: string;
      displayOrder: number;
      count: number;
      dates: string[];
    }>();

    rows.forEach((row) => {
      row.participants.forEach((participant) => {
        const current = participantBarMap.get(participant.id);
        participantBarMap.set(participant.id, {
          ...participant,
          count: (current?.count || 0) + 1,
          dates: [...(current?.dates || []), row.date],
        });
      });
    });

    const participantBars = Array.from(participantBarMap.values()).map((participant) => {
      const recoveryDates = Array.from(new Set(participant.dates)).sort();
      const timeline = Array.from(certifiedTimelineByParticipant.get(participant.id)?.entries() || [])
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB));
      let activeEpisodeStart: string | null = null;
      let latestEpisodeStart: string | null = recoveryDates[0] || null;
      let latestEpisodeEnd: string | null = null;

      timeline.forEach(([date, isRecovery]) => {
        if (isRecovery) {
          if (!activeEpisodeStart) {
            activeEpisodeStart = date;
            latestEpisodeStart = date;
            latestEpisodeEnd = null;
          }
          return;
        }

        if (activeEpisodeStart) {
          latestEpisodeStart = activeEpisodeStart;
          latestEpisodeEnd = date;
          activeEpisodeStart = null;
        }
      });

      if (activeEpisodeStart) {
        latestEpisodeStart = activeEpisodeStart;
        latestEpisodeEnd = null;
      }

      return {
        ...participant,
        count: recoveryDates.length,
        dates: recoveryDates,
        maxConsecutive: maxConsecutiveRecoveryDays(recoveryDates),
        symptomStartDate: latestEpisodeStart,
        recoveryCompleteDate: latestEpisodeEnd,
      };
    }).sort((a, b) => (
      b.count - a.count || a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "ko")
    ));
    const todayParticipants = Array.from(participantsByDate.get(effectiveToday)?.values() || []).sort((a, b) => (
      a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "ko")
    ));
    const recentWindowStart = toIsoDate(addDays(new Date(`${recoveryEndDate}T00:00:00`), -6));
    const previousWindowEnd = toIsoDate(addDays(new Date(`${recentWindowStart}T00:00:00`), -1));
    const previousWindowStart = toIsoDate(addDays(new Date(`${previousWindowEnd}T00:00:00`), -6));
    const collectParticipantsBetween = (from: string, to: string) => {
      const participantIds = new Set<string>();

      rows
        .filter((row) => row.date >= from && row.date <= to)
        .forEach((row) => row.participants.forEach((participant) => participantIds.add(participant.id)));

      return participantBars.filter((participant) => participantIds.has(participant.id));
    };
    const recentParticipants = collectParticipantsBetween(recentWindowStart, recoveryEndDate);
    const previousParticipants = collectParticipantsBetween(previousWindowStart, previousWindowEnd);
    const recentNewParticipants = participantBars.filter((participant) => (
      Boolean(participant.dates[0]) && participant.dates[0] >= recentWindowStart && participant.dates[0] <= recoveryEndDate
    ));
    const repeatRecoveryParticipants = participantBars.filter((participant) => participant.count >= 3);
    const consecutiveRecoveryParticipants = participantBars.filter((participant) => participant.maxConsecutive >= 3);

    return {
      totalParticipants,
      totalCertifications,
      totalParticipantRatio: ratioPercentage(totalParticipants, certificationParticipants.length),
      recentParticipantRatio: ratioPercentage(recentParticipants.length, certificationParticipants.length),
      recentNewParticipantRatio: ratioPercentage(recentNewParticipants.length, certificationParticipants.length),
      repeatParticipantRatio: ratioPercentage(repeatRecoveryParticipants.length, certificationParticipants.length),
      consecutiveParticipantRatio: ratioPercentage(consecutiveRecoveryParticipants.length, certificationParticipants.length),
      recentParticipantDelta: recentParticipants.length - previousParticipants.length,
      dailyTrend,
      participantBars,
      todayParticipants,
      recentParticipants,
      recentNewParticipants,
      recentWindowStart,
      recoveryEndDate,
      repeatRecoveryParticipants,
      consecutiveRecoveryParticipants,
      rows,
    };
  }, [certificationParticipantIds, certificationParticipants.length, participants, records]);

  const selectedRecordsParticipant = useMemo(
    () => participants.find((participant) => participant.id === selectedRecordsParticipantId) || null,
    [participants, selectedRecordsParticipantId]
  );
  const selectedRecordsParticipantRecoveryUsageCount = useMemo(() => (
    participantProgress.find((row) => row.participant.id === selectedRecordsParticipantId)?.recoveryUsageCount || 0
  ), [participantProgress, selectedRecordsParticipantId]);

  const selectedParticipantRecords = useMemo(() => (
    records
      .filter((record) => record.participant_id === selectedRecordsParticipantId && record.record_date)
      .sort((a, b) => (b.record_date || "").localeCompare(a.record_date || "") || b.id.localeCompare(a.id))
  ), [records, selectedRecordsParticipantId]);
  const addParticipant = useCallback(async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, nickname: newNickname }),
    });
    if (res.ok) {
      setNewName("");
      setNewNickname("");
      await refreshAfterMutation();
    } else {
      const json = await res.json().catch(() => ({}));
      alert(typeof json.error === "string" ? json.error : "멤버를 저장하지 못했어요. 이름을 다시 확인해주세요.");
    }
  }, [newName, newNickname, refreshAfterMutation]);

  const editingParticipant = useMemo(
    () => participants.find((participant) => participant.id === editingParticipantId) || null,
    [editingParticipantId, participants]
  );

  const startEditParticipant = useCallback((participant: Participant) => {
    setEditingParticipantId(participant.id);
    setNewName(participant.name);
    setNewNickname(participant.nickname || "");
  }, []);

  const resetParticipantForm = useCallback(() => {
    setEditingParticipantId("");
    setNewName("");
    setNewNickname("");
  }, []);

  const openManualRecordForDate = useCallback((date: string, participantId = "") => {
    setTargetDate(date);
    setManualDate(date);
    setManualParticipantId(participantId);
    setManualDistance("");
    setManualDuration("");
    setAdminModal("record");
  }, []);

  const openUploadForDate = useCallback((date: string) => {
    setTargetDate(date);
    setFiles([]);
    setUploadParticipantId("");
    setUploadNewName("");
    setAnalysisResults([]);
    setAnalysisMessage("");
    setAdminModal("upload");
  }, []);

  const saveParticipant = useCallback(async () => {
    if (!newName.trim()) return;
    if (!editingParticipantId) {
      await addParticipant();
      return;
    }

    const res = await fetch(`/api/participants/${editingParticipantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, nickname: newNickname }),
    });

    if (res.ok) {
      resetParticipantForm();
      await refreshAfterMutation();
    } else {
      const json = await res.json().catch(() => ({}));
      alert(typeof json.error === "string" ? json.error : "멤버 정보를 수정하지 못했어요.");
    }
  }, [addParticipant, editingParticipantId, newName, newNickname, refreshAfterMutation, resetParticipantForm]);

  const deleteParticipant = useCallback(async (participantId: string) => {
    if (!window.confirm("이 멤버를 목록에서 제외할까요? 기존 러닝 기록은 그대로 보관됩니다.")) return;
    const res = await fetch(`/api/participants/${participantId}`, { method: "DELETE" });
    if (res.ok) {
      if (editingParticipantId === participantId) resetParticipantForm();
      await refreshAfterMutation();
    } else {
      alert("멤버를 삭제하지 못했어요.");
    }
  }, [editingParticipantId, refreshAfterMutation, resetParticipantForm]);

  const addUploadParticipant = useCallback(async () => {
    const name = uploadNewName.trim();
    if (!name) return;

    const existingParticipant = participants.find((participant) => participant.name.trim() === name);
    if (existingParticipant) {
      setUploadParticipantId(existingParticipant.id);
      setUploadNewName("");
      setAnalysisMessage(`${existingParticipant.name}님을 선택했어요.`);
      return;
    }

    setAddingUploadParticipant(true);
    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nickname: "" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "멤버를 저장하지 못했어요.");

      const participant = json.participant as Participant | undefined;
      if (participant?.id) {
        setParticipants((current) => (
          current.some((item) => item.id === participant.id) ? current : [...current, participant]
        ));
        setUploadParticipantId(participant.id);
        setManualParticipantId((current) => current || participant.id);
        setUploadNewName("");
        setAnalysisMessage(`${participant.name}님을 추가했어요.`);
      }
      await refreshAfterMutation(false);
    } catch (err) {
      setAnalysisMessage(err instanceof Error ? err.message : "멤버를 저장하지 못했어요.");
    } finally {
      setAddingUploadParticipant(false);
    }
  }, [participants, refreshAfterMutation, uploadNewName]);

  const postAnalyzeImages = useCallback(async (images: PendingAnalyzeImage[]) => {
    const results: AnalysisResult[] = [];

    for (let index = 0; index < images.length; index += IMAGE_UPLOAD_CHUNK_SIZE) {
      const chunk = images.slice(index, index + IMAGE_UPLOAD_CHUNK_SIZE);
      setAnalysisMessage(
        images.length <= IMAGE_UPLOAD_CHUNK_SIZE
          ? `OCR 일괄 인식 중... ${chunk.length}장`
          : `OCR 일괄 인식 중... ${Math.min(index + chunk.length, images.length)}/${images.length}`
      );
      const res = await fetch("/api/records/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate, fallbackParticipantId: uploadParticipantId || null, images: chunk }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "analysis failed");
      if (Array.isArray(json.results)) results.push(...(json.results as AnalysisResult[]).map(hydrateAnalysisResult));
    }

    return results;
  }, [targetDate, uploadParticipantId]);

  const queueDroppedImages = useCallback((fileList: FileList | File[]) => {
    const selectedImages = getImageFiles(fileList);
    setUploadDragActive(false);

    if (analyzing) {
      setAnalysisMessage("OCR 인식 중에는 새 이미지를 추가하지 않아요. 잠시만 기다려주세요.");
      return;
    }

    if (!selectedImages.length) {
      setAnalysisMessage("이미지 파일만 올릴 수 있어요.");
      return;
    }

    const existingKeys = new Set(files.map(getImageFileKey));
    const nextFiles = [...files];
    let addedCount = 0;
    let duplicateCount = 0;
    let overflowCount = 0;

    selectedImages.forEach((file) => {
      const fileKey = getImageFileKey(file);
      if (existingKeys.has(fileKey)) {
        duplicateCount += 1;
        return;
      }
      if (nextFiles.length >= MAX_BATCH_IMAGE_FILES) {
        overflowCount += 1;
        return;
      }
      existingKeys.add(fileKey);
      nextFiles.push(file);
      addedCount += 1;
    });

    setFiles(nextFiles);
    setAnalysisResults([]);
    setAnalysisMessage([
      `${nextFiles.length}장 등록 대기`,
      addedCount ? `${addedCount}장 추가` : null,
      duplicateCount ? `중복 ${duplicateCount}장 제외` : null,
      overflowCount ? `최대 ${MAX_BATCH_IMAGE_FILES}장까지만` : null,
      "버튼을 누르면 한 번에 인식합니다",
    ].filter(Boolean).join(" · "));
  }, [analyzing, files]);

  const analyzeQueuedImages = useCallback(async () => {
    if (analyzing) return;
    const queuedFiles = files.slice(0, MAX_BATCH_IMAGE_FILES);
    if (!queuedFiles.length) {
      setAnalysisMessage("이미지를 먼저 드래그앤드랍으로 올려주세요.");
      return;
    }

    setAnalysisResults([]);
    setAnalyzing(true);
    try {
      setAnalysisMessage(`이미지 최적화 중... 0/${queuedFiles.length}`);
      const images = await preparePendingAnalyzeImages(queuedFiles, (completed) => {
        setAnalysisMessage(`이미지 최적화 중... ${completed}/${queuedFiles.length}`);
      });
      setAnalysisMessage(`OCR 일괄 인식 중... ${images.length}장`);
      const results = await postAnalyzeImages(images);
      setFiles([]);
      setAnalysisResults(results);
      const certified = results.filter((result) => result.status === "certified").length;
      const duplicate = results.filter((result) => result.duplicate || result.status === "duplicate").length;
      const review = results.length - certified - duplicate;
      setAnalysisMessage(`${results.length}장 정리 완료 · 인증 반영 ${certified}건 · 이미 인증 ${duplicate}건 · 보류 ${review}건`);
      await refreshAfterMutation();
    } catch (err) {
      setAnalysisMessage(err instanceof Error ? err.message : "이미지를 읽지 못했어요. 흐린 이미지는 직접 입력으로 가볍게 보완해주세요.");
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, files, postAnalyzeImages, refreshAfterMutation]);

  const handleUploadDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setUploadDragActive(true);
  }, []);

  const handleUploadDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setUploadDragActive(false);
  }, []);

  const handleUploadDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    queueDroppedImages(event.dataTransfer.files);
  }, [queueDroppedImages]);

  const updateAnalysisParticipant = useCallback(async (resultIndex: number, participantId: string) => {
    const result = analysisResults[resultIndex];
    const participant = participants.find((item) => item.id === participantId);
    if (!result || !participant) return;

    if (result.duplicate || result.status === "duplicate") {
      setAnalysisMessage("이미 인증된 기록은 중복 저장하지 않았어요. 수정은 멤버 카드의 날짜별 기록에서 진행해주세요.");
      return;
    }

    if (!result.id) {
      setAnalysisMessage("저장된 기록이 없는 이미지예요. 날짜를 확인한 뒤 다시 자동 인식해주세요.");
      return;
    }

    const resultKey = getAnalysisResultKey(result, resultIndex);
    setUpdatingAnalysisKey(resultKey);

    try {
      const res = await fetch(`/api/records/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: participant.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "멤버를 저장하지 못했어요.");

      setAnalysisResults((current) => current.map((item, index) => (
        index === resultIndex
          ? { ...item, participant_id: participant.id, participant_name: participant.name }
          : item
      )));
      setAnalysisMessage(`${participant.name}님으로 연결했어요.`);
      await refreshAfterMutation(false);
    } catch (err) {
      setAnalysisMessage(err instanceof Error ? err.message : "멤버를 저장하지 못했어요.");
    } finally {
      setUpdatingAnalysisKey("");
    }
  }, [analysisResults, participants, refreshAfterMutation]);

  const updateAnalysisDraft = useCallback((resultIndex: number, field: "edit_distance" | "edit_duration", value: string) => {
    setAnalysisResults((current) => current.map((item, index) => (
      index === resultIndex ? { ...item, [field]: value } : item
    )));
  }, []);

  const saveAnalysisRecord = useCallback(async (resultIndex: number) => {
    const result = analysisResults[resultIndex];
    if (!result?.id) {
      setAnalysisMessage("저장된 기록이 없는 이미지예요. 날짜를 확인한 뒤 다시 자동 인식해주세요.");
      return;
    }
    if (result.duplicate || result.status === "duplicate") {
      setAnalysisMessage("이미 인증된 기록은 중복 저장하지 않았어요. 수정은 멤버 카드의 날짜별 기록에서 진행해주세요.");
      return;
    }

    const durationSeconds = parseDurationToSeconds(result.edit_duration || "");
    const hasMetric = Boolean((result.edit_distance || "").trim() || durationSeconds);
    const nextStatus: RecordStatus = result.participant_id && result.record_date && hasMetric ? "certified" : "missing";
    const nextNotes = nextRecordNotesForStatus(nextStatus, result);
    const resultKey = getAnalysisResultKey(result, resultIndex);
    setUpdatingAnalysisKey(resultKey);

    try {
      const res = await fetch(`/api/records/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance_km: result.edit_distance || null,
          duration_seconds: durationSeconds,
          status: nextStatus,
          notes: nextNotes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "기록을 수정하지 못했어요.");

      setAnalysisResults((current) => current.map((item, index) => (
        index === resultIndex
          ? {
              ...item,
              distance_km: result.edit_distance ? Number(result.edit_distance) : null,
              duration_seconds: durationSeconds,
              status: nextStatus,
              edit_distance: result.edit_distance || "",
              edit_duration: result.edit_duration || "",
              notes: nextNotes,
            }
          : item
      )));
      setAnalysisMessage(nextStatus === "certified" ? "거리와 시간을 저장했어요." : "보류 상태로 저장했어요. 멤버, 거리, 시간을 확인해주세요.");
      await refreshAfterMutation(false);
    } catch (err) {
      setAnalysisMessage(err instanceof Error ? err.message : "기록을 수정하지 못했어요.");
    } finally {
      setUpdatingAnalysisKey("");
    }
  }, [analysisResults, refreshAfterMutation]);

  const openParticipantRecords = useCallback((participantId: string) => {
    const drafts = records
      .filter((record) => record.participant_id === participantId && record.id)
      .reduce<Record<string, { distance: string; duration: string }>>((acc, record) => {
        acc[record.id] = {
          distance: formatDistanceInput(record.distance_km),
          duration: formatDurationInput(record.duration_seconds),
        };
        return acc;
      }, {});
    setSelectedRecordsParticipantId(participantId);
    setRecordDrafts(drafts);
    setAdminModal("participantRecords");
  }, [records]);

  const updateRecordDraft = useCallback((recordId: string, field: "distance" | "duration", value: string) => {
    setRecordDrafts((current) => ({
      ...current,
      [recordId]: {
        distance: current[recordId]?.distance || "",
        duration: current[recordId]?.duration || "",
        [field]: value,
      },
    }));
  }, []);

  const saveExistingRecord = useCallback(async (record: RunRecord) => {
    const draft = recordDrafts[record.id] || {
      distance: formatDistanceInput(record.distance_km),
      duration: formatDurationInput(record.duration_seconds),
    };
    const durationSeconds = parseDurationToSeconds(draft.duration);
    const hasMetric = Boolean(draft.distance.trim() || durationSeconds);
    const nextStatus: RecordStatus = record.participant_id && record.record_date && hasMetric ? "certified" : "missing";
    const nextNotes = nextRecordNotesForStatus(nextStatus, record);
    setUpdatingRecordId(record.id);

    try {
      const res = await fetch(`/api/records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance_km: draft.distance || null,
          duration_seconds: durationSeconds,
          status: nextStatus,
          notes: nextNotes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "기록을 수정하지 못했어요.");

      await refreshAfterMutation(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "기록을 수정하지 못했어요.");
    } finally {
      setUpdatingRecordId("");
    }
  }, [recordDrafts, refreshAfterMutation]);

  const toggleRecordRecovery = useCallback(async (record: RunRecord, recoveryEnabled: boolean) => {
    const draft = recordDrafts[record.id] || {
      distance: formatDistanceInput(record.distance_km),
      duration: formatDurationInput(record.duration_seconds),
    };
    let nextDistance = draft.distance;
    let nextDurationInput = draft.duration;
    let durationSeconds = parseDurationToSeconds(nextDurationInput);

    if (recoveryEnabled) {
      if (!nextDistance.trim()) nextDistance = String(RECOVERY_CERTIFICATION_DISTANCE_KM);
      if (!durationSeconds) {
        durationSeconds = RECOVERY_CERTIFICATION_DURATION_SECONDS;
        nextDurationInput = secondsToTime(RECOVERY_CERTIFICATION_DURATION_SECONDS);
      }
    }

    const hasMetric = Boolean(nextDistance.trim() || durationSeconds);
    const nextStatus: RecordStatus = record.participant_id && record.record_date && hasMetric ? "certified" : "missing";
    const nextNotes = nextRecoveryRecordNotes(record.notes, recoveryEnabled);
    const nextSourceApp = nextRecoverySourceApp(record.source_app, recoveryEnabled);
    const parsedDistance = nextDistance.trim() ? Number(nextDistance) : null;
    const nextDistanceKm = parsedDistance !== null && Number.isFinite(parsedDistance) ? parsedDistance : null;
    setUpdatingRecordId(record.id);

    try {
      const res = await fetch(`/api/records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance_km: nextDistance || null,
          duration_seconds: durationSeconds,
          status: nextStatus,
          source_app: nextSourceApp,
          notes: nextNotes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "리커버리 표시를 저장하지 못했어요.");

      setRecordDrafts((current) => ({
        ...current,
        [record.id]: {
          distance: nextDistance,
          duration: nextDurationInput,
        },
      }));
      setRecords((current) => current.map((item) => (
        item.id === record.id
          ? {
              ...item,
              distance_km: nextDistanceKm,
              duration_seconds: durationSeconds,
              status: nextStatus,
              source_app: nextSourceApp,
              notes: nextNotes,
            }
          : item
      )));
      await refreshAfterMutation(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "리커버리 표시를 저장하지 못했어요.");
    } finally {
      setUpdatingRecordId("");
    }
  }, [recordDrafts, refreshAfterMutation]);

  const deleteExistingRecord = useCallback(async (record: RunRecord) => {
    if (!record.record_date) return;
    const participantName = selectedRecordsParticipant?.name || "선택한 멤버";
    if (!window.confirm(`${participantName}님의 ${record.record_date} 인증을 삭제할까요? 삭제하면 인증률과 누적 거리/시간에서도 빠집니다.`)) return;

    setDeletingRecordId(record.id);
    try {
      const res = await fetch(`/api/records/${record.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "기록을 삭제하지 못했어요.");

      setRecordDrafts((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      await refreshAfterMutation(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "기록을 삭제하지 못했어요.");
    } finally {
      setDeletingRecordId("");
    }
  }, [refreshAfterMutation, selectedRecordsParticipant?.name]);

  const saveManualRecord = useCallback(async () => {
    const duration = parseDurationToSeconds(manualDuration);
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: manualParticipantId,
        record_date: manualDate,
        distance_km: manualDistance,
        duration_seconds: duration,
        status: manualDistance || duration ? "certified" : "needs_review",
        notes: !manualDistance || !duration ? "거리 또는 시간은 나중에 보완 가능" : null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setManualDistance("");
      setManualDuration("");
      setAdminModal(null);
      await refreshAfterMutation();
    } else {
      alert(typeof json.error === "string" ? json.error : "기록을 저장하지 못했어요.");
    }
  }, [manualDate, manualDistance, manualDuration, manualParticipantId, refreshAfterMutation]);

  const sendAdminCode = useCallback(async () => {
    setSendingCode(true);
    setAuthMessage("");
    const response = await fetch("/api/admin/session", { method: "PUT" });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      setAuthMessage(typeof json.error === "string" ? json.error : "인증번호를 보내지 못했어요. Supabase 이메일 OTP 설정을 확인해주세요.");
    } else {
      setCodeSent(true);
      setAuthMessage("관리자 이메일로 인증번호를 보냈어요. 메일함을 확인해주세요.");
    }
    setSendingCode(false);
  }, []);

  const verifyAdminCode = useCallback(async () => {
    const token = otp.replace(/\D/g, "");
    if (!token) return;
    setVerifyingCode(true);
    setAuthMessage("");
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      setAuthMessage(typeof json.error === "string" ? json.error : "인증번호가 맞지 않거나 만료됐어요. 새 번호를 받아 다시 들어와주세요.");
      setAuthorized(false);
    } else {
      setAuthorized(true);
      setUserName(json.user?.name || "운영자");
      setUserAvatar(json.user?.avatar || "");
      await loadData();
    }
    setVerifyingCode(false);
  }, [loadData, otp]);

  const handleLogout = useCallback(() => {
    fetch("/api/admin/session", { method: "DELETE" }).then(() => {
      setAuthorized(false);
      setUserName("");
      setUserAvatar("");
      router.refresh();
    });
  }, [router]);

  const isInitialAdminLoading = loading && participants.length === 0;

  if (!mounted || !authReady) return <div className="min-h-screen bg-oriwan-bg" />;

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-oriwan-bg px-3 py-6 sm:px-5 sm:py-8">
        <div className="relative w-full max-w-[430px]">
          <div className="card mobile-page-card p-6 sm:p-9">
            <div className="mb-7 flex items-center gap-3">
              <TwttBrandMark className="aspect-[640/310] w-[132px] sm:w-[148px]" sizes="(max-width: 640px) 132px, 148px" priority label="TWTT" />
              <div>
                <h1 className="text-2xl font-black leading-tight text-oriwan-text">어드민 접속</h1>
                <p className="mt-1 text-xs font-bold text-oriwan-text-muted">운영자 이메일 인증</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <button
                onClick={sendAdminCode}
                disabled={sendingCode}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-lime-200 disabled:opacity-50"
              >
                {sendingCode ? "발송 중..." : codeSent ? "인증번호 다시 발송" : "인증번호 발송"}
              </button>
              <label className="block text-xs font-black text-oriwan-text-muted" htmlFor="admin-otp">
                인증번호
                <input
                  id="admin-otp"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") verifyAdminCode();
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  aria-describedby={authMessage ? "admin-auth-message" : undefined}
                  placeholder="메일로 받은 인증번호"
                  className="mt-1 w-full rounded-2xl border border-oriwan-border bg-white px-4 py-3 text-center text-lg font-black tracking-[0.18em] outline-none focus:border-oriwan-primary"
                />
              </label>
              <button onClick={verifyAdminCode} disabled={!otp.trim() || verifyingCode} className="w-full rounded-2xl bg-lime-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40">
                {verifyingCode ? "확인하는 중..." : "어드민으로 들어가기"}
              </button>
            </div>

            {authMessage && <p id="admin-auth-message" className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-oriwan-text-muted" role="status">{authMessage}</p>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-oriwan-bg">
      <header className="sticky top-0 z-50 px-4 py-3 bg-[#101522]/92 backdrop-blur-2xl border-b border-white/10 text-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TwttBrandMark className="aspect-[640/310] w-[82px] sm:w-[96px]" sizes="(max-width: 640px) 82px, 96px" label="TWTT" />
            <div>
              <h1 className="text-base font-black leading-none sm:text-lg">어드민</h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black ${liveStatus === "syncing" ? "bg-lime-300 text-slate-950" : "bg-white/10 text-white/70"}`}>
              <IconSync size={13} className={liveStatus === "syncing" ? "animate-spin" : ""} />
              {liveStatus === "syncing" ? "동기화 중" : "보호 모드"}
            </span>
            {userAvatar && <Image src={userAvatar} alt="" width={28} height={28} className="rounded-full border border-white/20" />}
            <span className="hidden md:inline text-xs font-semibold text-white/60">{userName}</span>
            <button onClick={handleLogout} className="text-xs text-white/60 hover:text-white transition-colors font-medium">로그아웃</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 pb-10 sm:px-4 sm:py-5">
        <nav
          className="sticky top-[61px] z-40 -mx-1 overflow-x-auto rounded-[20px] bg-white/94 p-1.5 shadow-lg shadow-slate-950/5 ring-1 ring-slate-950/5 backdrop-blur-xl"
          role="tablist"
          aria-label="어드민 관리 영역"
        >
          <div className="flex min-w-max gap-1 sm:min-w-0">
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`admin-panel-${tab.key}`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                onClick={() => selectAdminTab(tab.key)}
                onKeyDown={(event) => {
                  const currentIndex = ADMIN_TABS.findIndex((item) => item.key === tab.key);
                  let nextIndex = currentIndex;
                  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % ADMIN_TABS.length;
                  else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + ADMIN_TABS.length) % ADMIN_TABS.length;
                  else if (event.key === "Home") nextIndex = 0;
                  else if (event.key === "End") nextIndex = ADMIN_TABS.length - 1;
                  else return;
                  event.preventDefault();
                  selectAdminTab(ADMIN_TABS[nextIndex].key);
                  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']");
                  buttons?.[nextIndex]?.focus();
                }}
                className={`min-h-11 min-w-[88px] flex-1 rounded-2xl px-4 text-xs font-black transition sm:text-sm ${
                  activeTab === tab.key
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-oriwan-text-muted hover:bg-oriwan-surface-light hover:text-oriwan-text"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {activeTab === "certifications" ? (
          <div id="admin-panel-certifications" role="tabpanel" className="space-y-4">
        <section className="relative overflow-hidden rounded-[28px] bg-[#101522] p-4 text-white shadow-2xl shadow-slate-950/15 ring-1 ring-white/10 sm:p-5 lg:p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/50 to-transparent" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-stretch">
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase text-lime-200/70">Admin Console</p>
                  <h2 className="mt-1 text-2xl font-black leading-tight text-white sm:text-3xl">오늘 운영 현황</h2>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white/70 ring-1 ring-white/10">
                  <IconCalendar size={14} />
                  {effectiveToday.slice(5).replace("-", ".")}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 rounded-[26px] bg-white/[0.07] p-4 ring-1 ring-white/10 sm:p-5">
                <div className="min-w-0">
                  <p className="text-xs font-black text-white/45">오늘 인증</p>
                  <p className="mt-1 text-[clamp(3rem,14vw,5rem)] font-black leading-none text-lime-200">{adminStats.todayRate}%</p>
                  <p className="mt-2 text-xs font-semibold text-white/55">{adminStats.todayCertifiedCount}/{certificationParticipants.length}명 인증 완료</p>
                </div>
                <div className="grid gap-2 text-right">
                  <span className="rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
                    <span className="block text-[10px] font-black text-white/40">검수 대기</span>
                    <span className="text-lg font-black text-white">{adminStats.reviewCount}</span>
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/[0.08] px-3 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-black text-white/40">누적 거리</p>
                  <p className="mt-1 text-base font-black text-white">{adminStats.totalDistanceKm.toFixed(1)}km</p>
                </div>
                <div className="rounded-2xl bg-white/[0.08] px-3 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-black text-white/40">누적 시간</p>
                  <p className="mt-1 text-base font-black text-white">{secondsToTime(adminStats.totalDurationSeconds)}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black text-white/40">오늘 미인증</p>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white ring-1 ring-white/10">
                      {todayMissingParticipants.length}
                    </span>
                  </div>
                  <div className="mt-2 max-h-36 overflow-y-auto pr-1">
                    {todayMissingParticipants.length ? (
                      <div className="grid gap-1.5">
                        {todayMissingParticipants.map((participant) => (
                          <button
                            key={participant.id}
                            type="button"
                            onClick={() => openManualRecordForDate(effectiveToday, participant.id)}
                            className="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl bg-white/[0.08] px-3 py-2 text-left ring-1 ring-white/10 transition hover:bg-white/[0.13]"
                          >
                            <span className="min-w-0 truncate text-sm font-black text-white">{participant.name}</span>
                            <span className="shrink-0 text-[10px] font-black text-lime-200">{formatAdminDate(effectiveToday)}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-lime-300/15 px-3 py-3 text-center text-xs font-black text-lime-200 ring-1 ring-lime-300/20">
                        모두 완료
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black text-white/40">검수 대기 상세</p>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white ring-1 ring-white/10">
                      {reviewRecords.length}
                    </span>
                  </div>
                  <div className="mt-2 max-h-36 overflow-y-auto pr-1">
                    {reviewRecords.length ? (
                      <div className="grid gap-1.5">
                        {reviewRecords.map(({ record, participantName }) => (
                          <button
                            key={record.id}
                            type="button"
                            onClick={() => {
                              if (record.participant_id) openParticipantRecords(record.participant_id);
                            }}
                            className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-xl bg-white/[0.08] px-3 py-2 text-left ring-1 ring-white/10 transition ${
                              record.participant_id ? "hover:bg-white/[0.13]" : "cursor-default"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black text-white">{participantName}</span>
                              <span className="mt-0.5 block truncate text-[10px] font-semibold text-white/45">
                                {record.notes || "확인 필요"}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-[10px] font-black text-lime-200">{formatAdminDate(record.record_date)}</span>
                              {record.created_at && (
                                <span className="mt-0.5 block text-[10px] font-semibold text-white/45">
                                  등록 {formatKstTime(record.created_at)}
                                </span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-lime-300/15 px-3 py-3 text-center text-xs font-black text-lime-200 ring-1 ring-lime-300/20">
                        대기 없음
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2.5">
              <AdminActionButton
                title="이미지 올리기"
                meta="OCR"
                icon={<IconRun size={18} />}
                variant="primary"
                onClick={() => openUploadForDate(initialUploadDate)}
              />
              <AdminActionButton
                title="멤버 관리"
                meta={`${participants.length}명`}
                icon={<IconTarget size={18} />}
                onClick={() => {
                  resetParticipantForm();
                  setAdminModal("participant");
                }}
              />
              <AdminActionButton
                title="직접 입력"
                meta="기록 추가"
                icon={<IconCheck size={18} />}
                onClick={() => openManualRecordForDate(effectiveToday)}
              />
            </div>
          </div>
        </section>

        {setupMessage && (
          <section className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950">
            {setupMessage}
            <span className="mt-1 block text-xs font-semibold text-amber-800">
              저장소의 docs/supabase-schema.sql 파일 전체를 Supabase Dashboard의 SQL Editor에서 실행하면 바로 연결됩니다.
            </span>
          </section>
        )}

        <section className="card mobile-page-card overflow-hidden p-0">
          <div className="border-b border-slate-950/5 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase text-oriwan-text-muted">Crew Gauge</p>
                <h2 className="mt-1 text-xl font-black leading-tight text-oriwan-text">스내사 크루별 인증게이지</h2>
              </div>
              <span className="inline-flex w-fit shrink-0 rounded-full bg-lime-300 px-3 py-1.5 text-[11px] font-black text-slate-950 shadow-sm shadow-lime-300/30">
                {isInitialAdminLoading ? "멤버 불러오는 중" : `인증 대상 ${certificationParticipants.length}명`}
              </span>
            </div>
            <div className="mt-4 flex overflow-x-auto rounded-full bg-oriwan-surface-light p-1 ring-1 ring-slate-950/5">
              {PARTICIPANT_RANK_SORT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setParticipantSortMode(option.key)}
                  aria-pressed={participantSortMode === option.key}
                  className={`min-w-[72px] flex-1 rounded-full px-3 py-2 text-[11px] font-black transition ${
                    participantSortMode === option.key
                      ? "bg-slate-950 text-lime-200 shadow-sm"
                      : "text-oriwan-text-muted hover:text-oriwan-text"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 sm:p-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {isInitialAdminLoading && Array.from({ length: 6 }, (_, index) => (
                <div key={`admin-loading-${index}`} className="rounded-[22px] bg-white px-3.5 py-3.5 ring-1 ring-slate-950/5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-10 w-10 shrink-0 animate-pulse rounded-2xl bg-oriwan-surface-light" />
                      <span className="grid min-w-0 gap-1.5">
                        <span className="block h-3 w-20 animate-pulse rounded-full bg-oriwan-surface-light" />
                        <span className="block h-5 w-32 animate-pulse rounded-full bg-oriwan-surface-light" />
                      </span>
                    </div>
                    <span className="h-6 w-11 shrink-0 animate-pulse rounded-full bg-oriwan-surface-light" />
                  </div>
                  <div className="mt-3 h-2 animate-pulse rounded-full bg-oriwan-surface-light" />
                </div>
              ))}
              {sortedParticipantProgress.map((row, index) => (
                <button
                  key={row.participant.id}
                  type="button"
                  onClick={() => openParticipantRecords(row.participant.id)}
                  className={`relative overflow-hidden rounded-[22px] bg-white px-3.5 py-3.5 text-left ring-1 ring-slate-950/5 transition hover:-translate-y-0.5 hover:ring-lime-300 hover:shadow-lg hover:shadow-slate-950/5 ${
                    row.rate >= 100 ? "gauge-complete-card" : "dashboard-gauge-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="relative shrink-0">
                        <MemberPictogram index={row.pictogramIndex} participantName={row.participant.name} className="!h-11 !w-11" />
                        <span className="absolute -left-1 -top-1 rounded-full bg-slate-950 px-1.5 py-0.5 text-[9px] font-black leading-none text-lime-200 ring-2 ring-white">
                          {index + 1}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base font-black leading-tight text-oriwan-text">{row.participant.name}</p>
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-baseline gap-1 rounded-full bg-oriwan-surface-light px-2 py-0.5 text-[10px] font-black leading-none text-oriwan-text shadow-[inset_0_0_0_1px_rgba(16,21,34,0.05)]">
                            <span className="text-[8px] font-extrabold text-oriwan-text-muted">거리</span>
                            {row.distanceKm.toFixed(1)}km
                          </span>
                          <span className="inline-flex items-baseline gap-1 rounded-full bg-oriwan-surface-light px-2 py-0.5 text-[10px] font-black leading-none text-oriwan-text shadow-[inset_0_0_0_1px_rgba(16,21,34,0.05)]">
                            <span className="text-[8px] font-extrabold text-oriwan-text-muted">시간</span>
                            {secondsToTime(row.durationSeconds)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className={`shrink-0 text-2xl font-black leading-none ${gaugeTextClass(row.certifiedDays)}`}>
                      {row.rate}%
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-oriwan-surface-light">
                    <div
                      className={`gauge-fill-flow h-full rounded-full transition-all duration-1000 ease-out ${gaugeColorClass(row.certifiedDays)}`}
                      style={{ width: `${Math.max(row.rate, row.certifiedDays ? 3 : 0)}%` }}
                    />
                  </div>
                </button>
              ))}
              {!participantProgress.length && !loading && (
                <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-oriwan-text-muted sm:col-span-2 lg:col-span-3">
                  멤버가 추가되면 인증게이지가 바로 채워집니다.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="card mobile-page-card overflow-hidden p-0" aria-labelledby="recovery-certification-title">
          <div className="border-b border-slate-950/5 px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase text-oriwan-text-muted">Recovery Intelligence</p>
                <h2 id="recovery-certification-title" className="mt-1 text-xl font-black leading-tight text-oriwan-text">
                  리커버리 신호 대시보드
                </h2>
                <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-oriwan-text-muted">
                  누적·최근 7일·신규·반복·연속 신호를 나눠 현재 회복 부담과 변화 방향을 한눈에 보여줍니다.
                </p>
              </div>
              <span className="inline-flex w-fit shrink-0 rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-black text-lime-200">
                {formatAdminFullDate(effectiveToday)} 기준
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            {isInitialAdminLoading ? (
              <div className="space-y-3">
                <div className="animate-pulse rounded-[22px] bg-white px-4 py-5 ring-1 ring-slate-950/5">
                  <span className="block h-4 w-40 rounded-full bg-oriwan-surface-light" />
                  <span className="mt-4 block h-48 rounded-2xl bg-oriwan-surface-light" />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {Array.from({ length: 2 }, (_, index) => (
                    <div key={`recovery-loading-primary-${index}`} className="min-h-[210px] animate-pulse rounded-[26px] bg-white px-5 py-5 ring-1 ring-slate-950/5">
                      <span className="block h-3 w-24 rounded-full bg-oriwan-surface-light" />
                      <span className="mt-4 block h-6 w-40 rounded-full bg-oriwan-surface-light" />
                      <span className="mt-7 block h-12 w-28 rounded-2xl bg-oriwan-surface-light" />
                      <span className="mt-6 block h-2 rounded-full bg-oriwan-surface-light" />
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div key={`recovery-loading-secondary-${index}`} className="min-h-[190px] animate-pulse rounded-[26px] bg-white px-5 py-5 ring-1 ring-slate-950/5">
                      <span className="block h-3 w-20 rounded-full bg-oriwan-surface-light" />
                      <span className="mt-4 block h-5 w-32 rounded-full bg-oriwan-surface-light" />
                      <span className="mt-6 block h-10 w-20 rounded-2xl bg-oriwan-surface-light" />
                      <span className="mt-5 block h-2 rounded-full bg-oriwan-surface-light" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[11px] font-bold leading-5 text-amber-900 ring-1 ring-amber-200">
                  의료 진단 수치가 아니라 완료된 리커버리 인증 이력을 기준으로 계산한 운영 신호입니다. 증상·회복 날짜도 인증 흐름으로 추정합니다.
                </div>

                <div className="mt-3">
                  <RecoveryTrendLineChart data={recoveryCertificationSummary.dailyTrend} />
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <RecoveryMetricCard
                    eyebrow="Cumulative"
                    label="누적 리커버리"
                    value={recoveryCertificationSummary.totalParticipants}
                    unit="명"
                    percentage={recoveryCertificationSummary.totalParticipantRatio}
                    description={`전체 인증 대상 ${certificationParticipants.length}명 중 한 번 이상 리커버리 인증을 한 고유 인원입니다.`}
                    calculationLabel="계산: 전체 기간 리커버리 고유 인원 ÷ 전체 인증 대상"
                    membersLabel={formatCompactMemberNames(recoveryCertificationSummary.participantBars)}
                    tone="rose"
                    large
                  />
                  <RecoveryMetricCard
                    eyebrow="Last 7 Days"
                    label="최근 7일 리커버리 인증 인원"
                    value={recoveryCertificationSummary.recentParticipants.length}
                    unit="명"
                    percentage={recoveryCertificationSummary.recentParticipantRatio}
                    description={`${formatAdminDate(recoveryCertificationSummary.recentWindowStart)}부터 ${formatAdminDate(recoveryCertificationSummary.recoveryEndDate)}까지 한 번 이상 인증한 고유 인원입니다.`}
                    calculationLabel="계산: 최근 7일 리커버리 고유 인원 ÷ 전체 인증 대상"
                    membersLabel={formatCompactMemberNames(recoveryCertificationSummary.recentParticipants)}
                    deltaLabel={`${recoveryCertificationSummary.recentParticipantDelta >= 0 ? "+" : ""}${recoveryCertificationSummary.recentParticipantDelta}명 · 직전 7일 대비`}
                    tone="blue"
                    large
                  />
                </div>

                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <RecoveryMetricCard
                    eyebrow="New Signal"
                    label="최근 7일 신규 리커버리"
                    value={recoveryCertificationSummary.recentNewParticipants.length}
                    unit="명"
                    percentage={recoveryCertificationSummary.recentNewParticipantRatio}
                    description="최근 7일 안에 처음으로 리커버리 인증을 시작한 인원입니다."
                    calculationLabel="계산: 최초 리커버리 인증일이 최근 7일인 고유 인원"
                    membersLabel={formatCompactMemberNames(recoveryCertificationSummary.recentNewParticipants)}
                    tone="lime"
                  />
                  <RecoveryMetricCard
                    eyebrow="Repeat"
                    label="반복 리커버리 인원"
                    value={recoveryCertificationSummary.repeatRecoveryParticipants.length}
                    unit="명"
                    percentage={recoveryCertificationSummary.repeatParticipantRatio}
                    description="전체 기간 동안 리커버리 인증을 총 3회 이상 한 인원입니다."
                    calculationLabel="계산: 전체 기간 누적 리커버리 인증 3회 이상"
                    membersLabel={formatCompactMemberNames(recoveryCertificationSummary.repeatRecoveryParticipants)}
                    tone="amber"
                  />
                  <RecoveryMetricCard
                    eyebrow="Consecutive"
                    label="연속 리커버리 인원"
                    value={recoveryCertificationSummary.consecutiveRecoveryParticipants.length}
                    unit="명"
                    percentage={recoveryCertificationSummary.consecutiveParticipantRatio}
                    description="전체 기간 중 리커버리 인증이 3일 이상 연속된 인원입니다."
                    calculationLabel="계산: 최장 연속 리커버리 인증 3일 이상"
                    membersLabel={formatCompactMemberNames(recoveryCertificationSummary.consecutiveRecoveryParticipants)}
                    tone="violet"
                  />
                </div>

                <div className="mt-3 rounded-[22px] bg-slate-950 px-4 py-4 text-white sm:px-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Recovery Signal Guide</p>
                      <p className="mt-1 text-sm font-black leading-6 text-white">
                        누적 규모는 상단에서, 최근 증가·신규·반복·연속 신호는 하단 3개 지표와 추이선에서 함께 확인하세요.
                      </p>
                    </div>
                    <span className="w-fit shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black text-lime-200 ring-1 ring-white/10">
                      전체 대상 {certificationParticipants.length}명
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <RecoveryParticipantBarChart data={recoveryCertificationSummary.participantBars} />
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-oriwan-text">일자별 리커버리 인증</h3>
                    <p className="mt-0.5 text-[11px] font-bold text-oriwan-text-muted">최신 날짜부터 사용자별로 확인할 수 있어요.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-lime-100 px-3 py-1 text-[11px] font-black text-lime-800">
                    총 {recoveryCertificationSummary.totalCertifications}건
                  </span>
                </div>

                {recoveryCertificationSummary.rows.length ? (
                  <div className="mt-3 overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-950/5">
                    <div className="hidden grid-cols-[9rem_4rem_minmax(0,1fr)] gap-3 bg-slate-950 px-4 py-2.5 text-[10px] font-black text-white/55 sm:grid">
                      <span>인증 일자</span>
                      <span>인원</span>
                      <span>사용자</span>
                    </div>
                    <div className="divide-y divide-slate-950/5">
                      {recoveryCertificationSummary.rows.map((row) => (
                        <div key={row.date} className="grid gap-3 px-4 py-4 sm:grid-cols-[9rem_4rem_minmax(0,1fr)] sm:items-start">
                          <div className="flex items-center justify-between gap-3 sm:block">
                            <p className="text-sm font-black text-oriwan-text">{formatAdminFullDate(row.date)}</p>
                            <span className="rounded-full bg-lime-100 px-2.5 py-1 text-[11px] font-black text-lime-800 sm:hidden">
                              {row.participants.length}명
                            </span>
                          </div>
                          <span className="hidden w-fit rounded-full bg-lime-100 px-2.5 py-1 text-[11px] font-black text-lime-800 sm:inline-flex">
                            {row.participants.length}명
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {row.participants.map((participant) => (
                              <button
                                key={participant.id}
                                type="button"
                                onClick={() => openParticipantRecords(participant.id)}
                                className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-oriwan-surface-light px-2.5 py-1 text-xs font-black text-oriwan-text ring-1 ring-slate-950/5 transition hover:bg-slate-950 hover:text-lime-200"
                                aria-label={`${participant.name} 인증 기록 보기`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-lime-400" aria-hidden="true" />
                                {participant.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-[22px] bg-white px-4 py-10 text-center ring-1 ring-slate-950/5">
                    <p className="text-sm font-black text-oriwan-text">아직 완료된 리커버리 인증이 없어요.</p>
                    <p className="mt-1 text-xs font-semibold text-oriwan-text-muted">리커버리 인증이 완료되면 비율과 날짜별 현황이 함께 표시됩니다.</p>
                  </div>
                )}

                <div className="mt-5 rounded-[24px] bg-slate-950 px-4 py-5 text-white sm:px-5 sm:py-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-lime-200/60">Recovery Action Plan</p>
                      <h3 className="mt-1 text-lg font-black">운영 솔루션</h3>
                      <p className="mt-1 max-w-2xl text-[11px] font-bold leading-5 text-white/55">
                        현재 리커버리 신호를 오늘 확인, 반복 대상 관리, 안전한 복귀 안내 순서로 실행하세요.
                      </p>
                    </div>
                    <span className="w-fit shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black text-lime-200 ring-1 ring-white/10">
                      최근 7일 {formatAdminDate(recoveryCertificationSummary.recentWindowStart)}–{formatAdminDate(recoveryCertificationSummary.recoveryEndDate)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 lg:grid-cols-3">
                    <div className="rounded-[20px] bg-white/10 px-4 py-4 ring-1 ring-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black text-white">1. 오늘 즉시 확인</p>
                        <span className="rounded-full bg-rose-400/20 px-2 py-1 text-[10px] font-black text-rose-200">
                          {recoveryCertificationSummary.todayParticipants.length}명
                        </span>
                      </div>
                      <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-white/65">
                        {recoveryCertificationSummary.todayParticipants.length
                          ? `${recoveryCertificationSummary.todayParticipants.map((participant) => participant.name).join(", ")}님의 통증·보행 불편 여부를 확인하고 오늘은 러닝보다 회복 상태 기록을 우선 안내하세요.`
                          : "오늘 리커버리 인증자는 없습니다. 기존 영향 대상의 컨디션 변화를 정기적으로 확인하세요."}
                      </p>
                    </div>

                    <div className="rounded-[20px] bg-white/10 px-4 py-4 ring-1 ring-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black text-white">2. 반복·연속 신호 관리</p>
                        <span className="rounded-full bg-amber-400/20 px-2 py-1 text-[10px] font-black text-amber-200">
                          {recoveryCertificationSummary.repeatRecoveryParticipants.length}명
                        </span>
                      </div>
                      <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-white/65">
                        {recoveryCertificationSummary.repeatRecoveryParticipants.length
                          ? `전체 기간 3회 이상: ${recoveryCertificationSummary.repeatRecoveryParticipants.map((participant) => `${participant.name} ${participant.count}회`).join(", ")}.${recoveryCertificationSummary.consecutiveRecoveryParticipants.length ? ` 3일 이상 연속: ${recoveryCertificationSummary.consecutiveRecoveryParticipants.map((participant) => `${participant.name} ${participant.maxConsecutive}일`).join(", ")}.` : ""} 개별 컨디션과 러닝 재개 일정을 분리해 관리하세요.`
                          : "전체 기간 3회 이상 반복된 리커버리 신호는 없습니다. 새 신호가 생기는지만 관찰하세요."}
                      </p>
                    </div>

                    <div className="rounded-[20px] bg-white/10 px-4 py-4 ring-1 ring-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black text-white">3. 안전한 복귀 안내</p>
                        <span className="rounded-full bg-lime-300/20 px-2 py-1 text-[10px] font-black text-lime-200">공통</span>
                      </div>
                      <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-white/65">
                        통증이 있으면 러닝을 중단하고, 증상이 지속되거나 붓기·보행 불편이 있으면 의료진 상담을 안내하세요. 복귀는 통증이 가라앉고 기능이 회복된 뒤 단계적으로 진행합니다.
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-[10px] font-bold leading-4 text-white/40">
                    운영 참고용 리커버리 신호이며 의학적 진단을 대신하지 않습니다.
                  </p>
                </div>
              </>
            )}
          </div>
        </section>
          </div>
        ) : (
          <div id={`admin-panel-${activeTab}`} role="tabpanel">
            <AdminWorkspacePanel
              tab={activeTab}
              participants={participants}
              onOpenCrew={() => {
                resetParticipantForm();
                setAdminModal("participant");
              }}
            />
          </div>
        )}

        {adminModal === "upload" && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => setAdminModal(null)}
          >
            <div className="card mobile-sheet w-full max-w-2xl overflow-y-auto p-4 sm:max-h-[86svh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black leading-tight text-oriwan-text">이미지 등록</h2>
                  <p className="mt-1 text-xs font-bold leading-5 text-oriwan-text-muted">러닝 캡처를 빠르게 읽어 대시보드에 반영해요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminModal(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                <label className="block rounded-2xl bg-oriwan-surface-light p-3 text-xs font-black text-oriwan-text-muted">
                  기준 날짜
                  <input
                    type="date"
                    min={CHALLENGE_START_DATE}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-base font-black text-oriwan-text sm:text-sm"
                  />
                </label>

                <div className="rounded-2xl bg-oriwan-surface-light p-3">
                  <p className="text-xs font-black text-oriwan-text-muted">멤버 보정</p>
                  <div className="mt-1">
                    <MemberPicker
                      participants={participants}
                      value={uploadParticipantId}
                      onChange={setUploadParticipantId}
                      placeholder="이미지에서 자동 인식"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2 flex gap-2">
                <input
                  value={uploadNewName}
                  maxLength={40}
                  onChange={(event) => setUploadNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addUploadParticipant();
                  }}
                  placeholder="새 멤버 이름"
                  className="min-w-0 flex-1 rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-sm font-black text-oriwan-text outline-none focus:border-oriwan-primary"
                />
                <button
                  type="button"
                  onClick={addUploadParticipant}
                  disabled={!uploadNewName.trim() || addingUploadParticipant}
                  className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-lime-200 disabled:opacity-40"
                >
                  {addingUploadParticipant ? "추가 중" : "추가"}
                </button>
              </div>

              <div
                className={`mt-3 rounded-[22px] border-2 border-dashed p-3 transition ${
                  uploadDragActive
                    ? "border-lime-400 bg-lime-100 shadow-lg shadow-lime-300/20"
                    : "border-lime-300/80 bg-lime-50/70 hover:bg-lime-50"
                }`}
                onDragEnter={handleUploadDragOver}
                onDragOver={handleUploadDragOver}
                onDragLeave={handleUploadDragLeave}
                onDrop={handleUploadDrop}
              >
                <div className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-4 text-left ring-1 ring-slate-950/5">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xl font-black text-lime-200">
                      {uploadDragActive ? "↓" : analyzing ? "…" : "+"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-black text-oriwan-text">
                        {uploadDragActive ? "여기에 놓기" : analyzing ? "일괄 OCR 인식 중" : files.length ? `${files.length}장 등록 대기` : "이미지 드래그앤드랍"}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-bold text-oriwan-text-muted">
                        {analyzing ? "최대 20장을 한 번에 읽고 있어요" : files.length ? "더 놓으면 대기 목록에 추가됩니다" : "먼저 모아두고 버튼으로 한 번에 인식합니다"}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-lime-300 px-3 py-1 text-[11px] font-black text-slate-950">
                    최대 {MAX_BATCH_IMAGE_FILES}장
                  </span>
                </div>

                <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-lime-200 transition hover:bg-slate-800 focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-blue-500">
                  사진첩·파일에서 이미지 선택
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={analyzing}
                    className="sr-only"
                    onChange={(event) => {
                      if (event.target.files) queueDroppedImages(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>

                {files.length > 0 && (
                  <div className="mt-3 rounded-2xl bg-white/95 p-2.5 text-left ring-1 ring-slate-950/5">
                    <div className="grid max-h-32 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
                      {files.slice(0, 8).map((file, index) => {
                        const fileKey = getImageFileKey(file);
                        return (
                          <div key={fileKey} className="flex items-center justify-between gap-2 rounded-xl bg-oriwan-surface-light px-2.5 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-black text-oriwan-text">{index + 1}. {file.name}</p>
                              <p className="mt-0.5 text-[10px] font-semibold text-oriwan-text-muted">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                        );
                      })}
                      {files.length > 8 && (
                        <div className="rounded-xl bg-slate-950 px-2.5 py-2 text-[11px] font-black text-lime-200">
                          +{files.length - 8}장 더 선택됨
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={analyzeQueuedImages}
                  disabled={analyzing || !files.length}
                  className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-lime-200 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:bg-slate-300 disabled:text-white"
                >
                  {analyzing ? "인식 중..." : files.length ? `한번에 인식하기 (${files.length})` : "이미지를 드롭하면 시작 가능"}
                </button>
              </div>

              {analysisMessage && (
                <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-black text-oriwan-text ring-1 ring-slate-950/5">
                  {analysisMessage}
                </p>
              )}

              {analysisResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {analysisResults.map((result, index) => {
                    const status = result.status || "needs_review";
                    const resultKey = getAnalysisResultKey(result, index);
                    const isUpdatingResult = updatingAnalysisKey === resultKey;
                    const isDuplicate = result.duplicate || status === "duplicate";
                    return (
                      <div key={resultKey} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-950/5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-oriwan-text">
                              {result.participant_name || "멤버 선택"}
                            </p>
                            <p className="mt-1 truncate text-[11px] font-semibold text-oriwan-text-muted">{result.file_name}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(status)}`}>
                            {statusLabel(status)}
                          </span>
                        </div>
                        <div className="mt-3">
                          <p className="text-[10px] font-black text-oriwan-text-muted">멤버</p>
                          <div className="mt-1">
                            <MemberPicker
                              participants={participants}
                              value={result.participant_id || ""}
                              onChange={(participantId) => updateAnalysisParticipant(index, participantId)}
                              disabled={!result.id || isUpdatingResult || isDuplicate}
                              placeholder={result.id ? "멤버 선택" : "저장된 기록 없음"}
                            />
                          </div>
                        </div>
                        <div className="mt-3 rounded-xl bg-oriwan-surface-light px-3 py-2 text-xs font-black text-oriwan-text">
                          날짜 {result.record_date || "확인 필요"}
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input
                            value={result.edit_distance ?? ""}
                            onChange={(event) => updateAnalysisDraft(index, "edit_distance", event.target.value)}
                            inputMode="decimal"
                            placeholder="거리 km"
                            disabled={isDuplicate}
                            className="rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-sm font-black text-oriwan-text outline-none focus:border-oriwan-primary"
                          />
                          <input
                            value={result.edit_duration ?? ""}
                            onChange={(event) => updateAnalysisDraft(index, "edit_duration", event.target.value)}
                            placeholder="시간 예: 32:10"
                            disabled={isDuplicate}
                            className="rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-sm font-black text-oriwan-text outline-none focus:border-oriwan-primary"
                          />
                          <button
                            type="button"
                            onClick={() => saveAnalysisRecord(index)}
                            disabled={!result.id || isUpdatingResult || isDuplicate}
                            className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-lime-200 disabled:opacity-40"
                          >
                            {isDuplicate ? "저장 안 함" : isUpdatingResult ? "저장 중" : "수정 저장"}
                          </button>
                        </div>
                        {result.notes && <p className="mt-2 text-[11px] font-semibold leading-5 text-oriwan-text-muted">{result.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {adminModal === "participantRecords" && selectedRecordsParticipant && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => {
              setAdminModal(null);
              setSelectedRecordsParticipantId("");
            }}
          >
            <div className="card mobile-sheet w-full max-w-2xl overflow-y-auto p-4 sm:max-h-[88vh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <MemberPictogram
                    index={participantPictogramById.get(selectedRecordsParticipant.id)}
                    participantName={selectedRecordsParticipant.name}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-oriwan-text-muted">날짜별 기록 수정</p>
                    <h2 className="truncate text-2xl font-black leading-tight text-oriwan-text">
                      {selectedRecordsParticipant.name}
                    </h2>
                    {selectedRecordsParticipantRecoveryUsageCount > 0 && (
                      <p className="mt-1 inline-flex max-w-full items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-700 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.16)]">
                        + 리커버리 {selectedRecordsParticipantRecoveryUsageCount}일
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdminModal(null);
                    setSelectedRecordsParticipantId("");
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="space-y-2">
                {selectedParticipantRecords.map((record) => {
                  const draft = recordDrafts[record.id] || {
                    distance: formatDistanceInput(record.distance_km),
                    duration: formatDurationInput(record.duration_seconds),
                  };
                  const isSaving = updatingRecordId === record.id;
                  const isDeleting = deletingRecordId === record.id;
                  const isRecoveryRecord = isRecoveryCertificationRecord(record);
                  const recoveryToggleDisabled = isSaving || isDeleting;
                  const recoveryToggleTitle = isRecoveryRecord ? "리커버리 쉴드 사용 해제" : "리커버리 쉴드 사용";
                  const displayNotes = formatVisibleRecordNotes(record.notes);

                  return (
                    <div key={record.id} className="rounded-[22px] bg-white p-3 ring-1 ring-slate-950/5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-oriwan-text">{record.record_date}</p>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(record.status)}`}>
                          {statusLabel(record.status)}
                        </span>
                      </div>
                      <div className="grid gap-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            value={draft.distance}
                            onChange={(event) => updateRecordDraft(record.id, "distance", event.target.value)}
                            inputMode="decimal"
                            placeholder="거리 km"
                            className="w-full rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-sm font-black text-oriwan-text outline-none focus:border-oriwan-primary"
                          />
                          <input
                            value={draft.duration}
                            onChange={(event) => updateRecordDraft(record.id, "duration", event.target.value)}
                            placeholder="시간 예: 32:10"
                            className="w-full rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-sm font-black text-oriwan-text outline-none focus:border-oriwan-primary"
                          />
                        </div>
                        <div className="grid grid-cols-[5.25rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:flex sm:justify-end">
                          <button
                            type="button"
                            onClick={() => toggleRecordRecovery(record, !isRecoveryRecord)}
                            disabled={recoveryToggleDisabled}
                            aria-pressed={isRecoveryRecord}
                            aria-label={isRecoveryRecord ? "리커버리 쉴드 사용 해제" : "리커버리 쉴드 사용"}
                            title={recoveryToggleTitle}
                            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-xs font-black ring-1 transition disabled:opacity-40 ${
                              isRecoveryRecord
                                ? "bg-slate-950 text-lime-200 ring-slate-950"
                                : "bg-lime-50 text-slate-500 ring-lime-200 hover:bg-lime-100"
                            }`}
                          >
                            {isRecoveryRecord ? "회복 ON" : "회복"}
                          </button>
                          <button
                            type="button"
                            onClick={() => saveExistingRecord(record)}
                            disabled={isSaving || isDeleting}
                            className="min-h-11 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-lime-200 disabled:opacity-40"
                          >
                            {isSaving ? "저장 중" : "저장"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteExistingRecord(record)}
                            disabled={isSaving || isDeleting}
                            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100 disabled:opacity-40"
                          >
                            <IconTrash size={14} />
                            {isDeleting ? "삭제 중" : "삭제"}
                          </button>
                        </div>
                      </div>
                      {displayNotes && <p className="mt-2 text-[11px] font-semibold leading-5 text-oriwan-text-muted">{displayNotes}</p>}
                    </div>
                  );
                })}
                {!selectedParticipantRecords.length && (
                  <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-oriwan-text-muted ring-1 ring-slate-950/5">
                    아직 등록된 기록이 없어요. 이미지 올리기나 직접 입력으로 첫 기록을 넣어주세요.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {adminModal === "participant" && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => {
              setAdminModal(null);
              resetParticipantForm();
            }}
          >
            <div className="card mobile-sheet w-full max-w-2xl overflow-y-auto p-4 sm:max-h-[88vh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black leading-tight text-oriwan-text">멤버 관리</h2>
                  <p className="mt-1 text-xs text-oriwan-text-muted">기본 이름과 기존 내부 메모를 추가하거나 수정해요. 공개 소개는 크루 탭의 별도 영역에서 관리합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdminModal(null);
                    resetParticipantForm();
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="rounded-3xl bg-oriwan-surface-light p-4">
                <p className="mb-3 text-xs font-black text-oriwan-text">{editingParticipant ? "멤버 정보 수정" : "새 멤버 추가"}</p>
                <div className="grid gap-2">
                  <label className="text-xs font-black text-oriwan-text-muted">
                    이름
                    <input value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} placeholder="이름" className="mt-1.5 min-h-11 w-full rounded-xl border border-oriwan-border px-3 py-2.5 text-base" />
                  </label>
                  <label className="text-xs font-black text-oriwan-text-muted">
                    기존 내부 메모
                    <textarea
                      value={newNickname}
                      maxLength={320}
                      onChange={(e) => setNewNickname(e.target.value)}
                      placeholder="운영 참고용 내부 메모"
                      rows={4}
                      className="mt-1.5 w-full resize-none rounded-xl border border-oriwan-border px-3 py-2.5 text-base leading-6"
                    />
                  </label>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={saveParticipant} className="btn-primary flex-1 py-3 text-sm">
                    {editingParticipant ? "수정 저장" : "멤버 추가"}
                  </button>
                  {editingParticipant && (
                    <button type="button" onClick={resetParticipantForm} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-oriwan-text">
                      새 이름 입력
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex flex-col gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-950/5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2">
                      <MemberPictogram index={participantPictogramById.get(participant.id)} participantName={participant.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-oriwan-text">{participant.name}</p>
                        {participant.nickname && (
                          <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs font-semibold leading-5 text-oriwan-text-muted">
                            {participant.nickname}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:flex">
                      <button type="button" onClick={() => startEditParticipant(participant)} className="rounded-xl bg-oriwan-surface-light px-3 py-2 text-xs font-black text-oriwan-text">
                        변경
                      </button>
                      <button type="button" onClick={() => deleteParticipant(participant.id)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
                {!participants.length && <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-oriwan-text-muted">아직 멤버가 없어요. 첫 멤버부터 추가해볼까요?</p>}
              </div>
            </div>
          </div>
        )}

        {adminModal === "record" && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => setAdminModal(null)}
          >
            <div className="card mobile-sheet w-full max-w-xl overflow-y-auto p-4 sm:max-h-[88vh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black leading-tight text-oriwan-text">기록 직접 입력</h2>
                  <p className="mt-1 text-xs text-oriwan-text-muted">멤버, 날짜, 거리 또는 시간만 있어도 인증으로 저장돼요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminModal(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <MemberPicker participants={participants} value={manualParticipantId} onChange={setManualParticipantId} />
                <input type="date" min={CHALLENGE_START_DATE} value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
                <input value={manualDistance} onChange={(e) => setManualDistance(e.target.value)} placeholder="거리 km" inputMode="decimal" className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
                <input value={manualDuration} onChange={(e) => setManualDuration(e.target.value)} placeholder="시간 예: 32:10" className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
              </div>
              <button type="button" onClick={saveManualRecord} className="btn-primary mt-4 w-full py-3 text-sm">
                기록 저장하기
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
