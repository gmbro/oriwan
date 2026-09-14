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
  const approve = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await onApprove({ confirmed, expectedImageUrl: record.image_url, expectedNotes: record.notes });
      onCancel();
    } catch (e) { setError(e instanceof Error ? e.message : "승인하지 못했어요."); }
    finally { setBusy(false); }
  };
  return <ConfirmationDialog title="인증을 승인할까요?" description="관리자가 승인하면 운동·업로드 시각과 관계없이 인증 완료로 처리돼요."
    confirmLabel="인증 승인" destructive={false} busy={busy} disabled={!record.image_url || !confirmed}
    onCancel={onCancel} onConfirm={() => void approve()}>
    <p><strong>{record.record_date}</strong> · {record.distance_km ?? "미입력"}km · {record.duration_seconds === null ? "시간 미입력" : `${Math.floor(record.duration_seconds / 60)}분 ${record.duration_seconds % 60}초`}</p>
    <p>업로드: {review?.uploadedAt ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "medium", hour12: false }).format(new Date(review.uploadedAt)) : "시각 확인 불가"} (한국시간)</p>
    {record.image_url ? <a className="block rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700" href={`/api/me/records/image/${record.id}`} target="_blank" rel="noopener noreferrer">인증샷 확인 ↗</a>
      : <p role="alert">인증샷이 없어요. ‘이미지 올리기’에서 해당 멤버의 캡처본을 먼저 등록해주세요.</p>}
    <label className="mt-4 flex min-h-11 items-start gap-2 text-sm leading-6"><input className="mt-1.5" type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />인증샷의 멤버·운동일·기록을 확인했고, 관리자 판단으로 승인합니다.</label>
    {error && <p role="alert">{error}</p>}
  </ConfirmationDialog>;
}
