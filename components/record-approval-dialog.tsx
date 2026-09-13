"use client";

import { useState } from "react";
import { ConfirmationDialog } from "./confirmation-dialog";
import { readCertificationReview } from "@/lib/certification-review";

export function RecordApprovalDialog({ record, onCancel, onApprove }: {
  record: { id: string; record_date: string | null; image_url: string | null; notes: string | null; distance_km: number | null; duration_seconds: number | null };
  onCancel: () => void; onApprove: (approval: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const review = readCertificationReview(record.notes);
  const [captureDate, setCaptureDate] = useState(review?.ocrDate ?? "");
  const [captureTime, setCaptureTime] = useState(review?.ocrTime ?? "");
  const validEvidence = (captureDate === record.record_date && /^0[0-7]:[0-5]\d$/.test(captureTime));
  const approve = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await onApprove({ confirmed, evidenceConfirmed: confirmed, captureDate, captureTime, expectedImageUrl: record.image_url, expectedNotes: record.notes });
      onCancel();
    } catch (e) { setError(e instanceof Error ? e.message : "승인하지 못했어요."); }
    finally { setBusy(false); }
  };
  return <ConfirmationDialog title="인증을 승인할까요?" description="관리자가 인증샷을 확인하고 승인한 기록만 공식 인증에 반영돼요."
    confirmLabel="인증 승인" destructive={false} busy={busy} disabled={!record.image_url || !confirmed || !validEvidence}
    onCancel={onCancel} onConfirm={() => void approve()}>
    <p><strong>{record.record_date}</strong> · {record.distance_km ?? "미입력"}km · {record.duration_seconds === null ? "시간 미입력" : `${Math.floor(record.duration_seconds / 60)}분 ${record.duration_seconds % 60}초`}</p>
    <p>업로드: {review?.uploadedAt ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "medium", hour12: false }).format(new Date(review.uploadedAt)) : "시각 확인 불가"} (한국시간)</p>
    {record.image_url ? <a className="block rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700" href={`/api/me/records/image/${record.id}`} target="_blank" rel="noopener noreferrer">인증샷 확인 ↗</a>
      : <p role="alert">인증샷이 없어요. ‘이미지 올리기’에서 해당 멤버의 캡처본을 먼저 등록해주세요.</p>}
      <p>업로드 시각은 승인 기준이 아니에요. OCR이 읽은 운동일·시각을 사진과 비교하고, 비어 있거나 잘못 읽은 값은 수정해주세요. 같은 운동일의 오전 8시 이전 기록을 승인할 수 있어요. 운동 시간(분·초)이나 페이스는 인정 시각이 아니에요.</p>
      <div className="grid gap-3 text-sm">
        <label>캡처에 표시된 운동일<input className="mt-1 block min-h-11 w-full rounded-lg border p-2" type="date" value={captureDate} disabled={busy} onChange={e => setCaptureDate(e.target.value)} /></label>
        <label>캡처에 표시된 시각 (한국시간)<input className="mt-1 block min-h-11 w-full rounded-lg border p-2" type="time" min="00:00" max="07:59" value={captureTime} disabled={busy} onChange={e => setCaptureTime(e.target.value)} /></label>
      </div>
    <label className="mt-4 flex min-h-11 items-start gap-2 text-sm leading-6"><input className="mt-1.5" type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />인증샷의 멤버·운동일·기록과 오전 8시 이전 시각을 직접 확인했어요.</label>
    {error && <p role="alert">{error}</p>}
  </ConfirmationDialog>;
}
