"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { TimeMachineGoalInput } from "@/lib/time-machine-contract";
import styles from "./personal-goal.module.css";
export type TimeMachineStatus = {
  can_edit?: boolean; editable_at?: string | null;
  state: "empty" | "locked" | "opened"; progress: number; server_now: string; unlock_at: string;
  goal?: { title: string; detail: string; commitment: string; created_at: string }; error?: string;
};
export const PERSONAL_GOAL_CHANGED = "twtt:personal-goal-changed";
export function TimeMachineGoalBox({ initialRequest, initialStatus, onStatusChange, preview = false }: {
  initialRequest?: Promise<TimeMachineStatus>; initialStatus?: TimeMachineStatus; active?: boolean;
  onStatusChange?: (status: TimeMachineStatus) => void; preview?: boolean;
} = {}) {
  const [loading, setLoading] = useState(!initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<TimeMachineGoalInput>({ goal_title: initialStatus?.goal?.title ?? "", goal_detail: initialStatus?.goal?.detail ?? "", commitment: initialStatus?.goal?.commitment ?? "" });
  const dirty = useRef(false);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    // Read fresh on each visit so a previous warm request cannot restore an older goal.
    void fetch("/api/me/time-machine", { cache: "no-store", signal: controller.signal }).then(async response => {
      const payload: TimeMachineStatus = await response.json();
      if (!response.ok) throw new Error(payload.error || "목표를 불러오지 못했어요.");
      if (!controller.signal.aborted && !dirty.current) setForm({ goal_title: payload.goal?.title ?? "", goal_detail: payload.goal?.detail ?? "", commitment: payload.goal?.commitment ?? "" });
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [preview]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const payload: TimeMachineStatus = preview ? { state: "opened", progress: 0, server_now: new Date().toISOString(), unlock_at: "", goal: { title: form.goal_title.trim(), detail: form.goal_detail, commitment: form.commitment.trim(), created_at: new Date().toISOString() } } : await (async () => {
        const response = await fetch("/api/me/time-machine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || "목표를 저장하지 못했어요."); return result;
      })();
      onStatusChange?.(payload); setSaved(true); dirty.current = false;
      // Carry no personal text in global events. The owner-scoped banner re-reads its API.
      if (!preview) window.dispatchEvent(new Event(PERSONAL_GOAL_CHANGED));
    } catch (e) { setError(e instanceof Error ? e.message : "다시 시도해주세요."); }
    finally { setSaving(false); }
  };
  if (loading) return <p role="status" className={styles.note}>나의 목표를 불러오고 있어요.</p>;
  return <section className={styles.editor} aria-label="목표 설정">
    <div><span className={styles.eyebrow}>나와의 약속 · 100일</span><h3>나는 이렇게 달릴 거예요</h3><p className={styles.note}>잘 달리는 것보다 꾸준히 나아가는 마음.<br/>앞으로 100일 동안 지키고 싶은 다짐을 적어주세요.</p></div>
    <form onSubmit={save} className={styles.form}>
      <label>나의 목표<input required minLength={2} maxLength={80} value={form.goal_title} placeholder="조금 느려도, 나만의 속도로 꾸준히 달리기" onChange={e => { dirty.current = true; setSaved(false); setForm({ ...form, goal_title: e.target.value }); }} /><small>{form.goal_title.length}/80</small></label>
      <label>나의 다짐 <span className={styles.optional}>선택</span><textarea maxLength={300} rows={4} value={form.commitment} placeholder="힘든 날에는 10분이라도 움직이고, 어제의 나를 응원할 거예요." onChange={e => { dirty.current = true; setSaved(false); setForm({ ...form, commitment: e.target.value }); }} /><small>{form.commitment.length}/300</small></label>
      {form.goal_detail && <p className={styles.note}>이전에 적은 세부 목표: {form.goal_detail}</p>}
      <p className={styles.note}>나에게만 보여요. 저장한 다짐은 홈 상단에서 매일 확인할 수 있어요. 한번 설정하면 30일 동안 변경이 어려워요.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {saved && <p role="status" className={styles.success}>저장했어요. 오늘도 나의 다짐과 함께 달려요.</p>}
      <button className={styles.save} disabled={saving || form.goal_title.trim().length < 2}>{saving ? "저장 중…" : "목표 저장하기"}</button>
    </form>
  </section>;
}
