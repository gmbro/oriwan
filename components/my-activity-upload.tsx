"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MEMBER_EVIDENCE_ERROR, hasMemberUploadEvidence, MEMBER_UPLOAD_MAX_BYTES, type MemberUploadDraft } from "@/lib/member-upload-contract";
import styles from "./my-activity.module.css";

async function reduceScreenshot(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error("20MB 이하의 JPG, PNG, WebP 사진을 선택해주세요.");
  if (file.size <= 700 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / bitmap.width, 2400 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진 크기를 줄이지 못했어요.");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", .88));
    if (!blob || blob.size > MEMBER_UPLOAD_MAX_BYTES) throw new Error("사진 용량을 3MB 이하로 줄여 다시 선택해주세요.");
    if (blob.size >= file.size && file.size <= MEMBER_UPLOAD_MAX_BYTES) return file;
    return new File([blob], "running-screenshot.jpg", { type: "image/jpeg" });
  } finally { bitmap.close(); }
}

export default function MyActivityUpload({ today, onSubmitted, preview = false }: { today: string; onSubmitted: () => void; preview?: boolean }) {
  const [stage, setStage] = useState<"choose" | "uploading" | "analyzing" | "confirm" | "submitting" | "done">("choose");
  const [draft, setDraft] = useState<MemberUploadDraft | null>(null);
  const [progress, setProgress] = useState(0);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const [distance, setDistance] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("0");
  const xhr = useRef<XMLHttpRequest | null>(null);
  const alive = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; xhr.current?.abort(); }; }, []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);
  const acceptDraft = (value: MemberUploadDraft) => {
    if (!hasMemberUploadEvidence(value)) { setDraft(null); setError(MEMBER_EVIDENCE_ERROR); setStage("choose"); return; }
    setDraft(value); setDate(value.date || ""); setDistance(value.distanceKm === null ? "" : String(value.distanceKm));
    setMinutes(value.durationSeconds === null ? "" : String(Math.floor(value.durationSeconds / 60)));
    setSeconds(value.durationSeconds === null ? "0" : String(value.durationSeconds % 60)); setStage("confirm");
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setError(""); setDraft(null); setStage("uploading"); setProgress(0);
    try {
      const prepared = await reduceScreenshot(file);
      if (!alive.current) return;
      setImage(URL.createObjectURL(prepared));
      if (preview) {
        acceptDraft({ id: "preview", participantId: "preview", date: today, activityDate: today, activityTime: "07:35", distanceKm: 5.2, durationSeconds: 1930, confidence: .95, createdAt: "", rawText: "", model: "preview", warning: "미리보기 예시입니다. 실제 OCR·저장은 실행하지 않아요." });
        return;
      }
      const result = await new Promise<MemberUploadDraft>((resolve, reject) => {
        const req = new XMLHttpRequest(); xhr.current = req;
        req.open("POST", "/api/me/records/analyze"); req.timeout = 60_000;
        req.upload.onprogress = event => { if (event.lengthComputable && alive.current) { setProgress(Math.round(event.loaded / event.total * 100)); if (event.loaded === event.total) setStage("analyzing"); } };
        req.onload = () => { try { const result = JSON.parse(req.responseText); if (req.status < 200 || req.status >= 300 || !result.draft) throw new Error(result.error || "인식에 실패했어요."); resolve(result.draft); } catch (e) { reject(e); } };
        req.onerror = () => reject(new Error("네트워크 연결을 확인해주세요. 같은 사진으로 다시 시도할 수 있어요."));
        req.ontimeout = () => reject(new Error("서버 확인이 늦어지고 있어요. 잠시 후 같은 사진을 다시 선택해주세요."));
        req.onabort = () => reject(new Error("업로드를 취소했어요. 서버에 이미 전달된 인식은 완료될 수 있어요."));
        const form = new FormData(); form.set("file", prepared); req.send(form);
      });
      if (alive.current) acceptDraft(result);
    } catch (e) { if (alive.current) { setError(e instanceof Error ? e.message : "업로드하지 못했어요."); setStage("choose"); } }
    finally { xhr.current = null; }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!draft || stage === "submitting") return;
    setStage("submitting"); setError("");
    try {
      if (!preview) {
        const response = await fetch("/api/me/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: draft.id, date, distanceKm: Number(distance), durationSeconds: Number(minutes) * 60 + Number(seconds) }) });
        const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "제출하지 못했어요.");
      }
      if (alive.current) { setStage("done"); onSubmitted(); }
    } catch (e) { if (alive.current) { setStage("confirm"); setError(e instanceof Error ? e.message : "제출하지 못했어요."); } }
  };
  return <>
    {stage !== "done" && <p className={styles.uploadGuidance}>오전 8시 이전에 운동을 시작했다는 시각이 보이도록 업로드해주세요</p>}
    {stage !== "done" && <p className={styles.muted}>운동한 날짜마다 1건만 제출할 수 있어요. 운영자가 이미 등록한 날은 추가 제출할 수 없어요.</p>}
    {error && <p className={`${styles.feedback} ${styles.error}`} role="alert">{error}</p>}
    {stage === "done" ? <><div className={styles.feedback} role="status">{preview ? "미리보기 제출 완료 · 실제 저장 없음" : <><strong>인증이 완료되었습니다</strong><p>내 기록에 저장했어요. 현재 운영자 승인 대기 중이며, 공식 인증률과 공동 목표는 승인 후 반영돼요.</p><p>{date} · {distance}km · {minutes}분 {seconds}초</p></>}</div><button className={styles.primary} onClick={() => { setDraft(null); setStage("choose"); setImage(""); }}>다른 인증샷 올리기</button></> : <>
      {image && <Image unoptimized width={800} height={800} src={image} alt="내가 선택한 인증샷 미리보기" className={styles.preview} />}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      {stage === "choose" && <button className={styles.upload} type="button" aria-label="인증샷 업로드: 캡쳐 사진 선택" onClick={() => input.current?.click()}><span className={styles.uploadPlus} aria-hidden="true">＋</span></button>}
      {(stage === "uploading" || stage === "analyzing") && <div role="status"><strong>{stage === "uploading" ? `사진을 보내고 있어요 ${progress}%` : "날짜·거리·시간을 읽고 있어요"}</strong><progress className={styles.progress} max={100} value={stage === "uploading" ? progress : undefined} /><p className={styles.muted}>사진 인식에는 몇 초가 걸릴 수 있어요. 창을 닫아도 작업은 계속돼요.</p><button className={styles.secondary} onClick={() => xhr.current?.abort()}>업로드 취소</button></div>}
      {(stage === "confirm" || stage === "submitting") && <form className={styles.form} onSubmit={submit}>
        {draft?.warning && <p className={styles.feedback}>{draft.warning}</p>}
        <strong>사진과 기록이 맞는지 확인해주세요</strong>
        <label className={styles.field}>운동한 날짜<input required type="date" min="2026-08-13" max={today < "2026-12-31" ? today : "2026-12-31"} value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className={styles.field}>달린 거리 (km)<input required type="number" inputMode="decimal" min="0.001" max="300" step="0.001" placeholder="확인 필요" value={distance} onChange={e => setDistance(e.target.value)} /></label>
        <div className={styles.row}><label className={styles.field} style={{ flex: 1 }}>총 시간 (분)<input required type="number" inputMode="numeric" min="0" max="2880" step="1" placeholder="확인 필요" value={minutes} onChange={e => setMinutes(e.target.value)} /></label><label className={styles.field} style={{ flex: 1 }}>초<input required type="number" inputMode="numeric" min="0" max="59" step="1" value={seconds} onChange={e => setSeconds(e.target.value)} /></label></div>
        <p className={styles.muted}>자동 인식값을 수정하면 원래 인식값과 함께 운영자에게 전달돼요. 같은 날의 기록을 중복 제출할 수 없어요.</p>
        <button className={styles.primary} type="submit" disabled={stage === "submitting"}>{stage === "submitting" ? "제출 중…" : "인증 제출"}</button>
        <button className={styles.secondary} type="button" disabled={stage === "submitting"} onClick={() => input.current?.click()}>다른 사진 선택</button>
      </form>}
    </>}
  </>;
}
