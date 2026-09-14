"use client";
import { useEffect, useState } from "react";
import { openMyActivity } from "./my-activity-dialog";
import { PERSONAL_GOAL_CHANGED, type TimeMachineStatus } from "./time-machine-goal-box";
import styles from "./personal-goal.module.css";
export function PersonalGoalBanner({ preview, onEdit }: { preview?: TimeMachineStatus; onEdit?: () => void }) {
  const [status, setStatus] = useState<TimeMachineStatus | null>(preview ?? null);
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
  return <section className={styles.banner} aria-label="나만의 100일 목표">
    <div className={styles.bannerBody}><div className={styles.meta}><span className={styles.eyebrow}>나의 100일 다짐</span><span className={styles.private}>나만 보기</span></div>
      <h2>{status?.goal?.title || (error ? "나의 다짐을 다시 확인해주세요" : status ? "100일을 함께할 나만의 다짐" : "나의 다짐을 불러오고 있어요")}</h2>
      {status?.goal?.commitment ? <p>{status.goal.commitment}</p> : !status?.goal && <p>{error ? "목표 설정을 열어 다시 불러올 수 있어요." : "어떤 마음으로 달리고 싶은가요? 나와의 약속을 남겨보세요."}</p>}
    </div><button onClick={onEdit ?? (() => openMyActivity("time-machine"))}>{status?.goal ? "수정" : "목표 설정"}<span aria-hidden="true"> ↗</span></button>
  </section>;
}
