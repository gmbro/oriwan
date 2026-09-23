export const MEMBER_UPLOAD_BUCKET = "member-run-uploads";
export const MEMBER_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
export const MEMBER_UPLOAD_DAILY_LIMIT = 8;
export const MEMBER_UPLOAD_DRAFT_TTL = 24 * 60 * 60 * 1000;
export const MEMBER_UPLOAD_DRAFT_PATTERN = /^\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}$/;
export type MemberUploadDraft = {
  id: string; participantId: string; createdAt: string;
  date: string | null; distanceKm: number | null; durationSeconds: number | null;
  activityDate?: string | null; activityTime?: string | null;
  analysisError?: "configuration" | "timeout" | "response" | "service";
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

export function validateCertificationDate(date: unknown, today: string) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    return { ok: false as const, error: "인증 날짜를 확인해주세요." };
  }
  if (date > today) return { ok: false as const, error: "미래 날짜는 인증할 수 없어요." };
  if (date < "2026-08-13" || date > "2026-12-31") return { ok: false as const, error: "2026년 8월 13일부터 12월 31일까지의 기록만 제출할 수 있어요." };
  return { ok: true as const, date };
}

export const MEMBER_EVIDENCE_ERROR = "운동 시작 시간과 거리를 확인할 수 없어요, 운영자에게 문의주세요";
export function hasMemberUploadEvidence(draft: MemberUploadDraft) {
  return !draft.analysisError && /^0[0-7]:[0-5]\d$/.test(draft.activityTime ?? "")
    && typeof draft.distanceKm === "number" && Number.isFinite(draft.distanceKm)
    && draft.distanceKm >= 3 && draft.distanceKm <= 300;
}

export function memberEvidenceIssues(draft: MemberUploadDraft): string[] {
  if (draft.analysisError) return [draft.warning || "인식 서비스 응답을 받지 못했어요. 잠시 후 다시 시도하거나 운영자에게 문의해주세요."];
  const issues: string[] = [];
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.activityTime ?? ""))
    issues.push("사진에서 운동 시작 시각을 읽지 못했어요. 시작 시각이 보이는 전체 캡처를 선택해주세요.");
  if (/^(?:0[89]|1\d|2[0-3]):[0-5]\d$/.test(draft.activityTime ?? ""))
    issues.push(`사진에서 읽은 운동 시작 시각은 ${draft.activityTime}예요. 오전 8시 이전(00:00~07:59)에 시작한 운동만 인증할 수 있어요. 업로드 시각이 아닌 실제 운동 시작 시각 기준이에요.`);
  if (typeof draft.distanceKm !== "number" || !Number.isFinite(draft.distanceKm) || draft.distanceKm <= 0 || draft.distanceKm > 300)
    issues.push("사진에서 유효한 운동 거리를 읽지 못했어요. 거리와 km·m 단위가 보이는 캡처를 선택해주세요.");
  else if (draft.distanceKm < 3) issues.push(`사진에서 확인한 거리는 ${draft.distanceKm}km예요. 3km 이상 운동한 기록만 인증할 수 있어요.`);
  return issues;
}

// Certification belongs to the upload day; OCR is optional record enrichment.
export function memberUploadRecordValues(draft: MemberUploadDraft) {
  const date = new Date(Date.parse(draft.createdAt) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const distanceKm = !draft.analysisError && typeof draft.distanceKm === "number" && Number.isFinite(draft.distanceKm) && draft.distanceKm > 0 && draft.distanceKm <= 300 ? Math.round(draft.distanceKm * 1000) / 1000 : null;
  const durationSeconds = !draft.analysisError && typeof draft.durationSeconds === "number" && Number.isInteger(draft.durationSeconds) && draft.durationSeconds > 0 && draft.durationSeconds <= 172800 ? draft.durationSeconds : null;
  return { date, distanceKm, durationSeconds };
}
