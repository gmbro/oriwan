export type RecordStatus = "certified" | "needs_review" | "missing" | "rejected";

export const RECOVERY_CERTIFICATION_NOTE = "리커버리 쉴드";
export const RECOVERY_CERTIFICATION_LEGACY_NOTE = "리커버리 인증";
export const RECOVERY_CERTIFICATION_OVERRIDE_OFF_NOTE = "리커버리 쉴드 제외";
export const RECOVERY_CERTIFICATION_SOURCE = "recovery_certification";
export const RECOVERY_CERTIFICATION_DISTANCE_KM = 3;
export const RECOVERY_CERTIFICATION_DURATION_SECONDS = 20 * 60;
export const RECOVERY_CERTIFICATION_LIMIT = 3;

export function isCertificationCountedStatus(status: RecordStatus | string | null | undefined) {
  return status === "certified";
}

function normalizeRecoveryText(value: unknown) {
  return typeof value === "string" ? value.toLowerCase().replace(/\s+/g, "") : "";
}

export function hasRecoveryCertificationText(value: unknown) {
  const normalized = normalizeRecoveryText(value);
  return (
    normalized.includes(normalizeRecoveryText(RECOVERY_CERTIFICATION_NOTE)) ||
    normalized.includes(normalizeRecoveryText(RECOVERY_CERTIFICATION_LEGACY_NOTE)) ||
    normalized.includes(RECOVERY_CERTIFICATION_SOURCE)
  );
}

export function hasRecoveryCertificationOverrideOffText(value: unknown) {
  return normalizeRecoveryText(value).includes(normalizeRecoveryText(RECOVERY_CERTIFICATION_OVERRIDE_OFF_NOTE));
}

export function isRecoveryCertificationFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  const normalized = normalizeRecoveryText(value);
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized.includes("리커버리인증");
}

export function isRecoveryCertificationRecord(record: {
  is_recovery_certification?: boolean | null;
  notes?: string | null;
  raw_extracted_text?: string | null;
  source_app?: string | null;
}) {
  if (hasRecoveryCertificationOverrideOffText(record.notes)) return false;
  if (record.is_recovery_certification) return true;
  return (
    hasRecoveryCertificationText(record.notes) ||
    hasRecoveryCertificationText(record.raw_extracted_text) ||
    hasRecoveryCertificationText(record.source_app)
  );
}

export function secondsToTime(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function secondsToPace(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "-";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}'${String(s).padStart(2, "0")}"`;
}

export function parseDurationToSeconds(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().replace(/：/g, ":").replace(/\s+/g, "");
  if (!normalized) return null;

  const parseTimeParts = (parts: string[]) => {
    if (parts.length < 2 || parts.length > 3) return null;
    if (parts.some((part) => !/^\d+$/.test(part))) return null;

    const numbers = parts.map((part) => Number(part));
    if (numbers.some((part) => !Number.isFinite(part))) return null;

    if (numbers.length === 3) {
      const [hours, minutes, seconds] = numbers;
      if (minutes >= 60 || seconds >= 60) return null;
      return hours * 3600 + minutes * 60 + seconds;
    }

    const [minutes, seconds] = numbers;
    if (seconds >= 60) return null;
    return minutes * 60 + seconds;
  };

  if (normalized.includes(":")) {
    return parseTimeParts(normalized.split(":"));
  }

  if (/^\d+\.\d{2}(\.\d{2})?$/.test(normalized)) {
    return parseTimeParts(normalized.split("."));
  }

  const minutes = Number(normalized);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  return Math.round(minutes * 60);
}

export function calculatePaceSeconds(distanceKm: number | null, durationSeconds: number | null) {
  if (!distanceKm || !durationSeconds || distanceKm <= 0 || durationSeconds <= 0) return null;
  return Math.round(durationSeconds / distanceKm);
}

export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toKstDate(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

export function toKstIsoDate(date = new Date()) {
  const kstDate = toKstDate(date);
  return `${kstDate.getUTCFullYear()}-${String(kstDate.getUTCMonth() + 1).padStart(2, "0")}-${String(kstDate.getUTCDate()).padStart(2, "0")}`;
}

export function formatKstTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  const kstDate = toKstDate(date);
  return `${String(kstDate.getUTCHours()).padStart(2, "0")}:${String(kstDate.getUTCMinutes()).padStart(2, "0")}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
