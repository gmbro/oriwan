export const MEMBER_UPLOAD_BUCKET = "member-run-uploads";
export const MEMBER_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
export const MEMBER_UPLOAD_DAILY_LIMIT = 8;
export const MEMBER_UPLOAD_DRAFT_TTL = 24 * 60 * 60 * 1000;
export const MEMBER_UPLOAD_DRAFT_PATTERN = /^\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}$/;
export type MemberUploadDraft = {
  id: string; participantId: string; createdAt: string;
  date: string | null; distanceKm: number | null; durationSeconds: number | null;
  activityDate?: string | null; activityTime?: string | null;
  confidence: number | null; rawText: string; model: string; warning: string | null;
};

export function validateMemberSubmission(input: Record<string, unknown>, today: string) {
  const date = typeof input.date === "string" ? input.date : "";
  const distanceKm = typeof input.distanceKm === "number" ? input.distanceKm : NaN;
  const durationSeconds = typeof input.durationSeconds === "number" ? input.durationSeconds : NaN;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return { ok: false as const, error: "운동한 날짜를 확인해주세요." };
  if (date > today) return { ok: false as const, error: "미래 날짜는 제출할 수 없어요." };
  if (date < "2026-08-13" || date > "2026-12-31") return { ok: false as const, error: "2026년 8월 13일부터 12월 31일까지의 기록만 제출할 수 있어요." };
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 300) return { ok: false as const, error: "거리는 0보다 크고 300km 이하로 입력해주세요." };
  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0 || durationSeconds > 172800) return { ok: false as const, error: "운동 시간은 1초부터 48시간까지 입력해주세요." };
  return { ok: true as const, date, distanceKm: Math.round(distanceKm * 1000) / 1000, durationSeconds };
}

export function ownsFreshDraft(draft: MemberUploadDraft, participantId: string, now = Date.now()) {
  const age = now - Date.parse(draft.createdAt);
  return draft.participantId === participantId && Number.isFinite(age) && age >= 0 && age < MEMBER_UPLOAD_DRAFT_TTL;
}

export const MEMBER_EVIDENCE_ERROR = "운동 시작 시간과 거리를 확인할 수 없어요, 운영자에게 문의주세요";
export function hasMemberUploadEvidence(draft: MemberUploadDraft) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.activityTime ?? "")
    && typeof draft.distanceKm === "number" && Number.isFinite(draft.distanceKm)
    && draft.distanceKm > 0 && draft.distanceKm <= 300;
}
