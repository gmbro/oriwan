"use client";

import { useCallback, useRef, useState } from "react";
import { Hello2027Guestbook } from "@/app/poc/hello-2027/hello-2027-guestbook";
import { RecordApprovalDialog } from "@/components/record-approval-dialog";
import { removeHello2027CommentFromView } from "@/lib/hello-2027-comments-view";
import { reviewCertification, writeCertificationReview } from "@/lib/certification-review";
import type { Hello2027GuestbookThread } from "@/lib/hello-2027-types";

const comments: Hello2027GuestbookThread[] = [{ id: "demo-comment", author: "미리보기 러너", body: "삭제 확인용 가상 댓글", createdAt: "2026-09-10T22:00:00Z", ownedByViewer: true, reactions: [], replies: [{ id: "demo-reply", author: "미리보기 러너", body: "삭제 확인용 가상 답글", createdAt: "2026-09-10T22:01:00Z", ownedByViewer: true, reactions: [] }] }];
const notifyPreviewMutation = () => {};
const viewer = { authenticated: true, provider: "kakao" as const, display_name: "미리보기 러너", approved_participant: true };
export default function ReviewPreview() {
  const [nested, setNested] = useState(false);
  const [approval, setApproval] = useState<"early" | "late" | null>(null);
  const [result, setResult] = useState("가상 데이터만 사용 · 실제 API 호출 없음");
  const [deletes, setDeletes] = useState(0);
  const [failDelete, setFailDelete] = useState(false);
  const fail = useRef(false);
  const threads = useRef(comments);
  const outer = useCallback((node: HTMLDialogElement | null) => { if (node && !node.open) node.showModal(); }, []);
  const request = useCallback<typeof fetch>(async (_url, init) => {
    if (!init?.method) return Response.json({ threads: threads.current, live: true });
    if (init.method !== "DELETE") return Response.json({ error: "삭제만 검증하는 미리보기예요." }, { status: 400 });
    setDeletes(n => n + 1);
    if (fail.current) return Response.json({ error: "가상 삭제 실패: 댓글을 유지하고 재시도할 수 있어야 해요." }, { status: 500 });
    const { id } = JSON.parse(String(init.body));
    threads.current = removeHello2027CommentFromView(threads.current, id);
    return Response.json({ ok: true, id, status: "deleted" });
  }, []);
  const guestbook = <Hello2027Guestbook initialThreads={comments} externalViewerManaged externalViewer={viewer} management request={request} onMutation={notifyPreviewMutation} />;
  const record = { id: "local-preview", record_date: "2026-09-10", distance_km: 5.2, duration_seconds: 1930, image_url: "local-fixture", notes: writeCertificationReview("가상 인증샷", { version: 1, ocrDate: "2026-09-10", ocrTime: "07:35", uploadedAt: approval === "early" ? "2026-09-09T22:59:59Z" : "2026-09-09T23:00:00Z" }) };
  return <main style={{ padding: 20, background: "#f2f4f6", minHeight: "100dvh" }}>
    <h1>댓글·인증 승인 로컬 검증</h1><p role="status">{result}</p><p>삭제 요청: {deletes}회</p>
    <label><input type="checkbox" checked={failDelete} onChange={e => { setFailDelete(e.target.checked); fail.current = e.target.checked; }} />삭제 실패 재현</label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingBlock: 20 }}>
      <button className="btn-primary p-3" onClick={() => setNested(true)}>내 정보 안에서 댓글 열기</button>
      <button className="btn-primary p-3" onClick={() => setApproval("early")}>07:59 업로드 승인 검증</button>
      <button className="btn-primary p-3" onClick={() => setApproval("late")}>08:00 업로드 승인 검증</button>
    </div>
    {!nested && guestbook}
    {nested && <dialog ref={outer} style={{ width: "min(700px, 95vw)", maxHeight: "90dvh", padding: 20, borderRadius: 24 }} onCancel={() => setNested(false)}>
      <h2>내 정보 모달 예시</h2><button onClick={() => setNested(false)}>내 정보 닫기</button>{guestbook}
    </dialog>}
    {approval && <RecordApprovalDialog key={approval} record={record} onCancel={() => setApproval(null)} onApprove={async evidence => {
      const review = reviewCertification({ recordDate: record.record_date, imageUrl: record.image_url, review: { version: 1, ocrDate: "2026-09-10", ocrTime: "07:35", uploadedAt: approval === "early" ? "2026-09-09T22:59:59Z" : "2026-09-09T23:00:00Z" }, approval: evidence, adminId: "preview" });
      if (!review.ok) throw new Error(review.error);
      setResult(`가상 승인 완료: 캡처 시각 확인 · 실제 저장 없음`);
    }} />}
  </main>;
}
