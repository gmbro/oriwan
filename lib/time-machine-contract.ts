export const TIME_MACHINE_SEASON_KEY = "4th";
export const TIME_MACHINE_START_AT = "2026-09-23T00:00:00+09:00";
export const TIME_MACHINE_UNLOCK_AT = "2027-01-01T00:00:00+09:00";

export const MIN_TIME_MACHINE_GOAL_TITLE_LENGTH = 2;
export const MAX_TIME_MACHINE_GOAL_TITLE_LENGTH = 80;
export const MIN_TIME_MACHINE_GOAL_DETAIL_LENGTH = 0;
export const MAX_TIME_MACHINE_GOAL_DETAIL_LENGTH = 500;
export const MIN_TIME_MACHINE_COMMITMENT_LENGTH = 0;
export const MAX_TIME_MACHINE_COMMITMENT_LENGTH = 300;

export type TimeMachineGoalInput = {
  goal_title: string;
  goal_detail: string;
  commitment: string;
};

export type TimeMachineResetInput = {
  goal_id: string;
};

export type TimeMachineTiming = {
  started: boolean;
  unlocked: boolean;
  progress: number;
  server_now: string;
  unlock_at: string;
};

const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const START_AT_MS = Date.parse(TIME_MACHINE_START_AT);
const UNLOCK_AT_MS = Date.parse(TIME_MACHINE_UNLOCK_AT);

function normalizeGoalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFC")
    .replace(CONTROL_PATTERN, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function normalizeOptionalGoalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFC")
    .replace(CONTROL_PATTERN, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  return normalized.length <= maxLength ? normalized : null;
}

export function parseTimeMachineGoalInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false as const, error: "목표 내용을 다시 확인해주세요." };
  }
  const record = value as Record<string, unknown>;
  const goalTitle = normalizeGoalText(record.goal_title, MAX_TIME_MACHINE_GOAL_TITLE_LENGTH);
  const goalDetail = normalizeOptionalGoalText(record.goal_detail, MAX_TIME_MACHINE_GOAL_DETAIL_LENGTH);
  const commitment = normalizeOptionalGoalText(record.commitment, MAX_TIME_MACHINE_COMMITMENT_LENGTH);

  if (!goalTitle || goalTitle.length < MIN_TIME_MACHINE_GOAL_TITLE_LENGTH) {
    return { ok: false as const, error: `목표는 ${MIN_TIME_MACHINE_GOAL_TITLE_LENGTH}자 이상 적어주세요.` };
  }
  if (goalDetail === null) {
    return { ok: false as const, error: `세부 목표는 ${MAX_TIME_MACHINE_GOAL_DETAIL_LENGTH}자 이내로 적어주세요.` };
  }
  if (commitment === null) {
    return { ok: false as const, error: `나의 다짐은 ${MAX_TIME_MACHINE_COMMITMENT_LENGTH}자 이내로 적어주세요.` };
  }

  return {
    ok: true as const,
    value: {
      goal_title: goalTitle,
      goal_detail: goalDetail,
      commitment,
    } satisfies TimeMachineGoalInput,
  };
}

export function parseTimeMachineResetInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false as const, error: "재설정할 목표를 다시 선택해주세요." };
  }
  const goalId = (value as Record<string, unknown>).goal_id;
  if (typeof goalId !== "string" || !UUID_PATTERN.test(goalId)) {
    return { ok: false as const, error: "재설정할 목표를 다시 선택해주세요." };
  }
  return {
    ok: true as const,
    value: { goal_id: goalId } satisfies TimeMachineResetInput,
  };
}

export function getTimeMachineTiming(now: Date = new Date()): TimeMachineTiming {
  const nowMs = now.getTime();
  const progress = Math.min(1, Math.max(0, (nowMs - START_AT_MS) / (UNLOCK_AT_MS - START_AT_MS)));

  return {
    started: nowMs >= START_AT_MS,
    unlocked: nowMs >= UNLOCK_AT_MS,
    progress,
    server_now: now.toISOString(),
    unlock_at: TIME_MACHINE_UNLOCK_AT,
  };
}
