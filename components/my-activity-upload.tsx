"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {CertificationGuide} from "./certification-guide";
import {openMyActivity} from "./my-activity-dialog";
import { canSavePersonalRun, memberRunClassification, memberEvidenceIssues, MEMBER_UPLOAD_MAX_BYTES, type MemberUploadDraft } from "@/lib/member-upload-contract";
import { KoreanExerciseDate, formatKoreanExerciseDate } from "./korean-exercise-date";
import styles from "./my-activity.module.css";

export async function reduceScreenshot(file: File) {
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

export default function MyActivityUpload({ today, onSubmitted, onViewRecords, preview = false }: { today: string; onSubmitted: (date?: string) => void; onViewRecords?: () => void; preview?: boolean }) {
  const [stage, setStage] = useState<"choose" | "uploading" | "analyzing" | "confirm" | "submitting" | "done">("choose");
  const [personalConfirm,setPersonalConfirm] = useState(false);
  const [savedPersonal,setSavedPersonal] = useState(false);
  const [draft, setDraft] = useState<MemberUploadDraft | null>(null);
  const [progress, setProgress] = useState(0);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [guide,setGuide] = useState("");
  const [date, setDate] = useState(today);
  const [distance, setDistance] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("0");
  const xhr = useRef<XMLHttpRequest | null>(null);
  const alive = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; xhr.current?.abort(); }; }, []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);
  const acceptDraft = (value: MemberUploadDraft) => {
    setDraft(value); setDistance(value.distanceKm === null ? "" : String(value.distanceKm));
    setMinutes(value.durationSeconds === null ? "" : String(Math.floor(value.durationSeconds / 60)));
    setSeconds(value.durationSeconds === null ? "0" : String(value.durationSeconds % 60)); setStage("confirm");
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (!date || date < "2026-08-13" || date > today || date > "2026-12-31") { setError("사진 선택 전에 운동한 날짜를 확인해주세요."); return; }
    setError(""); setDraft(null); setStage("uploading"); setProgress(0);
    try {
      const prepared = await reduceScreenshot(file);
      if (!alive.current) return;
      setImage(URL.createObjectURL(prepared));
      if (preview) {
        acceptDraft({ id: "preview", participantId: "preview", date, activityDate: date, activityTime: "07:35", distanceKm: 5.2, durationSeconds: 1930, confidence: .95, createdAt: "", rawText: "", model: "preview", warning: "미리보기 예시입니다. 실제 OCR·저장은 실행하지 않아요." });
        return;
      }
      const result = await new Promise<MemberUploadDraft>((resolve, reject) => {
        const req = new XMLHttpRequest(); xhr.current = req;
        req.open("POST", "/api/me/records/analyze"); req.timeout = 60_000;
        req.upload.onprogress = event => { if (event.lengthComputable && alive.current) { setProgress(Math.round(event.loaded / event.total * 100)); if (event.loaded === event.total) setStage("analyzing"); } };
        req.onload = () => { try { const result = JSON.parse(req.responseText); if (req.status < 200 || req.status >= 300 || !result.draft) throw new Error(result.error || "서버에서 인식 결과를 받지 못했어요. 잠시 후 다시 시도해주세요."); resolve(result.draft); } catch (e) { reject(e); } };
        req.onerror = () => reject(new Error("네트워크 연결을 확인해주세요. 같은 사진으로 다시 시도할 수 있어요."));
        req.ontimeout = () => reject(new Error("서버 확인이 늦어지고 있어요. 잠시 후 같은 사진을 다시 선택해주세요."));
        req.onabort = () => reject(new Error("업로드를 취소했어요. 서버에 이미 전달된 인식은 완료될 수 있어요."));
        const form = new FormData(); form.set("file", prepared); req.send(form);
      });
      if (alive.current) acceptDraft(result);
    } catch (e) { if (alive.current) { setGuide(e instanceof Error ? e.message : "업로드하지 못했어요."); setStage("choose"); } }
    finally { xhr.current = null; }
  };
  const submit = async (event?: React.FormEvent, saveAsPersonal = false) => {
    event?.preventDefault(); if (!draft || stage === "submitting") return;
    const personal = memberRunClassification(draft,date) === "personal";
    if(personal && canSavePersonalRun(draft) && !saveAsPersonal){setPersonalConfirm(true);return;}
    setStage("submitting"); setError("");
    try {
      if (!preview) {
        const response = await fetch("/api/me/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: draft.id, date, saveAsPersonal, distanceKm: Number(distance), durationSeconds: Number(minutes) * 60 + Number(seconds) }) });
        const payload = await response.json(); if (!response.ok || !payload.record?.id) throw new Error(payload.error || "서버의 저장 완료를 확인하지 못했어요. 같은 내용으로 다시 제출하면 중복 저장 없이 확인할 수 있어요.");
      }
      if (alive.current) { setSavedPersonal(personal); setStage("done"); onSubmitted(date); if(!preview&&!personal&&date===today)openMyActivity("gift"); }
    } catch (e) { if (alive.current) { setStage("confirm"); setGuide(e instanceof Error ? e.message : "제출하지 못했어요."); } }
  };
  return <>
    {personalConfirm&&draft&&<CertificationGuide message={[...memberEvidenceIssues(draft),"개인 거리는 9월 1일부터 합산하며 인증일·보상에는 포함되지 않아요."].join("\n")} onClose={()=>setPersonalConfirm(false)} onConfirm={()=>{setPersonalConfirm(false);void submit(undefined,true);}}/>}
    {guide&&<CertificationGuide message={guide} onClose={()=>setGuide("")}/>}
    {stage !== "done" && <p className={styles.uploadGuidance}>3km 이상 · 오전 8시 이전 시작은 공식 인증, 그 외 운동은 확인 후 개인 기록으로 저장할 수 있어요.</p>}
    {["choose", "uploading", "analyzing"].includes(stage) && <div className={styles.field}>운동한 날짜 (사진 선택 전 확인)<KoreanExerciseDate min="2026-08-13" max={today < "2026-12-31" ? today : "2026-12-31"} value={date} disabled={stage !== "choose"} onChange={setDate} /></div>}
    {stage !== "done" && <p className={styles.muted}>운동한 날짜마다 1건만 제출할 수 있어요. 등록 실패 시 문의주시면 운영자가 업로드해드려요</p>}
    {error && <p className={`${styles.feedback} ${styles.error}`} role="alert">{error}</p>}
    {stage === "done" ? <><div className={styles.feedback} role="status">{preview ? "미리보기 제출 완료 · 실제 저장 없음" : <><strong>{savedPersonal ? "개인 기록을 저장했어요" : "인증이 완료되었습니다"}</strong><p>{savedPersonal ? "누적 거리에 반영되며 인증일·보상에는 포함되지 않아요." : "내 기록에 저장했어요. 오늘 기록이면 인증박스를 바로 열 수 있어요."}</p><p>{formatKoreanExerciseDate(date)} · {distance}km · {minutes}분 {seconds}초</p></>}</div>{onViewRecords && <button className={styles.primary} onClick={onViewRecords}>내 기록에서 확인하기</button>}<button className={styles.primary} onClick={() => { setDraft(null); setStage("choose"); setImage(""); }}>다른 인증샷 올리기</button></> : <>
      {image && <p className={styles.muted} role="status">{draft ? "사진 저장 완료 · " + (stage === "confirm" || stage === "submitting" ? "인식값 확인 후 인증 제출을 눌러주세요." : "인증 조건 또는 인식값 확인 필요 · 기록 미제출") : "선택한 사진 미리보기 · 아직 기록 제출 전이에요."}</p>}
      {image && <Image unoptimized width={800} height={800} src={image} alt="내가 선택한 인증샷 미리보기" className={styles.preview} />}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      {preview && stage === "choose" && <button type="button" className={styles.secondary} onClick={() => acceptDraft({ id: "preview", participantId: "preview", date, activityDate: date, activityTime: "07:35", distanceKm: 5.2, durationSeconds: 1930, confidence: .95, createdAt: "", rawText: "", model: "preview", warning: "체험용 기록 · 실제 저장 없음" })}>예시 기록으로 체험</button>}
      {stage === "choose" && <button className={styles.upload} type="button" aria-label="인증샷 업로드: 캡쳐 사진 선택" onClick={() => input.current?.click()}><span className={styles.uploadPlus} aria-hidden="true">＋</span></button>}
      {(stage === "uploading" || stage === "analyzing") && <div role="status"><strong>{stage === "uploading" ? `사진을 보내고 있어요 ${progress}%` : "날짜·거리·시간을 읽고 있어요"}</strong><progress className={styles.progress} max={100} value={stage === "uploading" ? progress : undefined} /><p className={styles.muted}>사진 전송과 인식이 끝나면 결과가 표시돼요. 페이지를 새로고침하거나 나가면 진행 상태가 사라질 수 있어요.</p><button className={styles.secondary} onClick={() => xhr.current?.abort()}>업로드 취소</button></div>}
      {(stage === "confirm" || stage === "submitting") && <form className={styles.form} onSubmit={submit}>
        {draft?.warning && <p className={styles.feedback}>{draft.warning}</p>}
        <strong>사진과 기록이 맞는지 확인해주세요</strong>
        <p className={styles.muted}>사진에서 읽은 운동 날짜: {(draft?.activityDate || draft?.date) ? formatKoreanExerciseDate((draft?.activityDate || draft?.date)!) : "사진에서 날짜를 읽지 못했어요. 선택한 날짜를 직접 확인해주세요."}<br/>운동 시작 시각: {draft?.activityTime}</p>
        {(draft?.activityDate || draft?.date) && (draft?.activityDate || draft?.date) !== date && <p className={styles.feedback}>선택한 날짜와 사진에서 읽은 날짜가 달라요. 사진을 확인한 후 제출해주세요. 운동한 날짜로 저장돼요.</p>}
        <div className={styles.field}>운동한 날짜<KoreanExerciseDate min="2026-08-13" max={today < "2026-12-31" ? today : "2026-12-31"} value={date} onChange={setDate} /></div>
        <label className={styles.field}>달린 거리 (km)<input readOnly type="number" inputMode="decimal" min="0.001" max="300" step="0.001" placeholder="확인 필요" value={distance} onChange={e => setDistance(e.target.value)} /></label>
        <div className={styles.row}><label className={styles.field} style={{ flex: 1 }}>총 시간 (분)<input readOnly type="number" inputMode="numeric" min="0" max="2880" step="1" placeholder="확인 필요" value={minutes} onChange={e => setMinutes(e.target.value)} /></label><label className={styles.field} style={{ flex: 1 }}>초<input readOnly type="number" inputMode="numeric" min="0" max="59" step="1" value={seconds} onChange={e => setSeconds(e.target.value)} /></label></div>
        <p className={styles.muted}>사진에서 확인한 값으로 인증해요. 인식값이 다르거나 비어 있으면 다른 사진을 선택하거나 운영자에게 문의해주세요.</p>
        <button className={styles.primary} type="submit" disabled={stage === "submitting"}>{stage === "submitting" ? "제출 중…" : "인증 제출"}</button>
        <button className={styles.secondary} type="button" disabled={stage === "submitting"} onClick={() => input.current?.click()}>다른 사진 선택</button>
      </form>}
    </>}
  </>;
}
