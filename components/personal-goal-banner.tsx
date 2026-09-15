"use client";
import { useEffect, useState } from "react";

import { PERSONAL_GOAL_CHANGED, type TimeMachineStatus } from "./time-machine-goal-box";
import styles from "./personal-goal.module.css";
export function PersonalGoalBanner({ preview, onEdit }: { preview?: TimeMachineStatus; onEdit?: () => void }) {
  const [status, setStatus] = useState<TimeMachineStatus | null>(preview ?? null);
  const [editing,setEditing]=useState(false);const [draft,setDraft]=useState("");const [saving,setSaving]=useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (preview) { setStatus(preview); return; }
    const controller = new AbortController(); let generation = 0;
    const read = async () => {
      const request = ++generation;
      try {
        const response = await fetch("/api/me/time-machine", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json(); if (!controller.signal.aborted && request === generation) { setStatus(data); setError(false); }
      } catch { if (!controller.signal.aborted && request === generation) setError(true); }
    };
    const focus = () => { if (document.visibilityState === "visible") void read(); };
    void read(); window.addEventListener(PERSONAL_GOAL_CHANGED, read); window.addEventListener("focus", focus);
    return () => { controller.abort(); window.removeEventListener(PERSONAL_GOAL_CHANGED, read); window.removeEventListener("focus", focus); };
  }, [preview]);
  const save=async(event:React.FormEvent)=>{event.preventDefault();if(saving)return;setSaving(true);setError(false);try{const response=await fetch("/api/me/time-machine",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({goal_title:draft.trim(),goal_detail:status?.goal?.detail??"",commitment:status?.goal?.commitment??""})});const data=await response.json();if(!response.ok)throw new Error();setStatus(data);setEditing(false);window.dispatchEvent(new Event(PERSONAL_GOAL_CHANGED));}catch{setError(true);}finally{setSaving(false);}};
  return <section className={styles.simpleBanner} aria-label="나만의 100일 목표">{editing?<form onSubmit={save}><input aria-label="100일 동안 다짐" placeholder="100일 동안 다짐을 적어주세요" required minLength={2} maxLength={80} value={draft} onChange={e=>setDraft(e.target.value)} autoFocus/><button disabled={saving}>{saving?"저장 중…":"저장"}</button><button type="button" onClick={()=>setEditing(false)}>취소</button></form>:<button className={styles.simpleGoal} onClick={()=>{if(onEdit){onEdit();return;}setDraft(status?.goal?.title??"");setEditing(true);}}><span>{status?.goal?.title||"100일 동안 다짐을 적어주세요"}</span><span aria-hidden="true">✎</span></button>}{error&&<p role="alert">목표를 불러오거나 저장하지 못했어요. 다시 시도해주세요.</p>}</section>;
}
