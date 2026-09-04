export const CORRECTIVE_EXERCISE_SEASON_KEY = "4th";

export const CORRECTIVE_EXERCISE_PAIN_AREAS = [
  "neck",
  "shoulder",
  "upper_back",
  "lower_back",
  "hip",
  "knee",
  "ankle",
  "foot",
  "elbow_wrist",
  "other",
] as const;

export const CORRECTIVE_EXERCISE_HOSPITAL_STATUSES = ["none", "past", "current"] as const;
export const CORRECTIVE_EXERCISE_APPLICATION_STATUSES = [
  "submitted",
  "reviewing",
  "schedule_proposed",
  "confirmed",
  "completed",
  "cancelled",
  "rejected",
] as const;

export type CorrectiveExercisePainArea = (typeof CORRECTIVE_EXERCISE_PAIN_AREAS)[number];
export type CorrectiveExerciseHospitalStatus = (typeof CORRECTIVE_EXERCISE_HOSPITAL_STATUSES)[number];
export type CorrectiveExerciseApplicationStatus = (typeof CORRECTIVE_EXERCISE_APPLICATION_STATUSES)[number];

export type CorrectiveExerciseSlot = {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string | null;
  capacity: number;
  remaining_capacity: number;
  active: boolean;
  note: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CorrectiveExerciseApplication = {
  id: string;
  participant_id?: string;
  participant_name: string;
  requested_slot_id: string | null;
  requested_date: string;
  requested_start_time: string;
  requested_end_time: string | null;
  pain_areas: CorrectiveExercisePainArea[];
  pain_context: string;
  hospital_status: CorrectiveExerciseHospitalStatus;
  hospital_note: string | null;
  additional_note: string | null;
  status: CorrectiveExerciseApplicationStatus;
  confirmed_for: string | null;
  admin_note?: string | null;
  consent_version: string;
  consented_at: string;
  retention_until: string;
  created_at: string;
  updated_at: string;
};

export type CorrectiveExerciseApplicationSummary = Pick<
  CorrectiveExerciseApplication,
  | "id"
  | "participant_id"
  | "participant_name"
  | "requested_slot_id"
  | "requested_date"
  | "requested_start_time"
  | "requested_end_time"
  | "status"
  | "confirmed_for"
  | "retention_until"
  | "created_at"
  | "updated_at"
>;

export const CORRECTIVE_EXERCISE_CONSENT_VERSION = "2026-09-04-v1";

export const MAX_CORRECTIVE_PAIN_AREAS = 5;
export const MAX_CORRECTIVE_PAIN_CONTEXT_LENGTH = 500;
export const MAX_CORRECTIVE_HOSPITAL_NOTE_LENGTH = 300;
export const MAX_CORRECTIVE_ADDITIONAL_NOTE_LENGTH = 500;
export const MAX_CORRECTIVE_ADMIN_NOTE_LENGTH = 500;
export const MAX_CORRECTIVE_SLOT_NOTE_LENGTH = 120;
export const MAX_CORRECTIVE_SLOT_CAPACITY = 20;

export const CORRECTIVE_PAIN_AREA_LABELS: Record<CorrectiveExercisePainArea, string> = {
  neck: "목",
  shoulder: "어깨",
  upper_back: "등",
  lower_back: "허리",
  hip: "골반·고관절",
  knee: "무릎",
  ankle: "발목",
  foot: "발",
  elbow_wrist: "팔꿈치·손목",
  other: "기타",
};

export const CORRECTIVE_HOSPITAL_STATUS_LABELS: Record<CorrectiveExerciseHospitalStatus, string> = {
  none: "병원에 다닌 적 없음",
  past: "이전에 진료받음",
  current: "현재 진료 중",
};

export const CORRECTIVE_APPLICATION_STATUS_LABELS: Record<CorrectiveExerciseApplicationStatus, string> = {
  submitted: "신청 완료",
  reviewing: "운영자 확인 중",
  schedule_proposed: "일정 조율 중",
  confirmed: "일정 확정",
  completed: "진행 완료",
  cancelled: "신청 취소",
  rejected: "진행 어려움",
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCorrectiveExercisePainArea(value: unknown): value is CorrectiveExercisePainArea {
  return typeof value === "string" && (CORRECTIVE_EXERCISE_PAIN_AREAS as readonly string[]).includes(value);
}

export function isCorrectiveExerciseHospitalStatus(value: unknown): value is CorrectiveExerciseHospitalStatus {
  return typeof value === "string" && (CORRECTIVE_EXERCISE_HOSPITAL_STATUSES as readonly string[]).includes(value);
}

export function isCorrectiveExerciseApplicationStatus(value: unknown): value is CorrectiveExerciseApplicationStatus {
  return typeof value === "string" && (CORRECTIVE_EXERCISE_APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeCorrectiveTime(value: unknown) {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) return null;
  return value.slice(0, 5);
}

export function normalizeCorrectiveText(value: unknown, maxLength: number, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if ((required && !normalized) || normalized.length > maxLength) return null;
  return normalized;
}
