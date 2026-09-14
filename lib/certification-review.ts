// Stored in the existing private notes field. Only server-owned upload times
// are accepted; client notes cannot replace this audit information.
const MARKER = "\n[TWTT_REVIEW_V1]";
export type CertificationReview = {
  version: 1;
  uploadedAt: string | null;
  approvedAt?: string;
  approvedBy?: string;
  basis?: "upload" | "screenshot" | "admin";
  ocrDate?: string | null;
  ocrTime?: string | null;
  captureDate?: string;
  captureTime?: string;
};
export function readCertificationReview(notes: string | null | undefined): CertificationReview | null {
  const index = notes?.indexOf(MARKER) ?? -1;
  if (index < 0) return null;
  try {
    const value = JSON.parse(notes!.slice(index + MARKER.length));
    if (value?.version !== 1 || !(value.uploadedAt === null || (typeof value.uploadedAt === "string" && Number.isFinite(Date.parse(value.uploadedAt))))) return null;
    return value;
  } catch { return null; }
}
export function visibleCertificationNotes(notes: string | null | undefined) {
  return (notes || "").split(MARKER)[0].trim();
}
export function writeCertificationReview(notes: string | null | undefined, review: CertificationReview) {
  return `${visibleCertificationNotes(notes).slice(0, 2800)}${MARKER}${JSON.stringify(review)}`;
}
export function wasUploadedBeforeDeadline(recordDate: string | null, uploadedAt: string | null | undefined) {
  if (!recordDate || !uploadedAt) return false;
  const time = Date.parse(uploadedAt);
  const dayStart = Date.parse(`${recordDate}T00:00:00+09:00`);
  return Number.isFinite(time) && time >= dayStart && time < dayStart + 8 * 60 * 60 * 1000;
}
export function reviewCertification(input: {
  recordDate: string | null; imageUrl: string | null; review: CertificationReview | null;
  approval: unknown; adminId: string; now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const approval = input.approval && typeof input.approval === "object" ? input.approval as Record<string, unknown> : {};
  if (approval.confirmed !== true) return { ok: false as const, error: "인증샷을 확인한 뒤 ‘인증 승인’을 눌러주세요." };
  const dayStart = Date.parse(`${input.recordDate}T00:00:00+09:00`);
  if (!input.recordDate || !Number.isFinite(dayStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.recordDate) || new Date(`${input.recordDate}T00:00:00Z`).toISOString().slice(0, 10) !== input.recordDate) return { ok: false as const, error: "운동한 날짜를 확인해주세요." };
  if (!input.imageUrl) return { ok: false as const, error: "인증샷이 필요해요. 이미지 올리기에서 해당 멤버의 캡처본을 먼저 등록해주세요." };
  const review: CertificationReview = { version: 1, uploadedAt: input.review?.uploadedAt ?? null, approvedAt: now, approvedBy: input.adminId, ocrDate: input.review?.ocrDate ?? null, ocrTime: input.review?.ocrTime ?? null };
  return { ok: true as const, review: { ...review, basis: "admin" as const } };
}
