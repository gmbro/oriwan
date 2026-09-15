"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { untilNextCertificationDay } from "@/lib/certification-ui";
import { CREW_CHEERS, type CrewCheerType } from "@/lib/crew-cheers";
import styles from "./visitor-crew-cheer.module.css";
export function VisitorCrewCheer() {
  const [reaction,setReaction] = useState<CrewCheerType|null>(null);
  const [sent, setSent] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pending, setPending] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const alive = useRef(true);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/crew-cheers", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error();
      if (alive.current) { setVisible(data.visible);setSent(Boolean(data.sent));setReaction(data.reaction ?? null);setReady(true);setError(""); }
    } catch { if (alive.current) { setReady(false);setError("응원 상태를 확인하지 못했어요."); } }
  }, []);
  useEffect(() => {
    alive.current = true; void load();
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { timer=setTimeout(()=>{setSent(false);setReady(false);void load();schedule();},untilNextCertificationDay()+50); };
    const refresh = () => { if (document.visibilityState === "visible" && !busy.current) void load(); };
    schedule(); window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
    return () => { alive.current=false;clearTimeout(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh); };
  }, [load]);
  async function send(type: CrewCheerType) {
    if (busy.current || sent) return;
    if (!ready) { await load();return; }
    busy.current=true;setPending(true);setError("");
    try {
      const response=await fetch("/api/crew-cheers", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type}) });
      const data=await response.json();
      if (response.status===403) { setVisible(false);return; }
      if (!response.ok || !data.sent) throw new Error();
      if (alive.current) { setSent(true);setReaction(data.reaction);setCelebrate(true); }
    } catch { if (alive.current) setError("응원을 보내지 못했어요. 다시 눌러주세요."); }
    finally { busy.current=false;if (alive.current) setPending(false); }
  }
  if (!visible) return null;
  return <div className={styles.cheer} aria-label="크루 응원">
    <span className={styles.label}>함께 달리는 크루에게</span>
    <div className={styles.actions} role="group" aria-label="응원 이모지 선택">{CREW_CHEERS.filter(cheer=>cheer.type==="heart").map(cheer=><button key={cheer.type} type="button" aria-label={`${cheer.label} 응원 보내기`} title={cheer.label} aria-pressed={sent} onClick={()=>void send(cheer.type)} disabled={sent || pending || (!ready&&!error)}><span aria-hidden="true">{cheer.emoji}</span></button>)}</div>
    <span className={styles.status} role="status">{sent?"응원을 보냈어요 ✓":pending?"보내는 중…":""}</span>
    {celebrate&&<span aria-hidden="true" className={styles.heart} onAnimationEnd={()=>setCelebrate(false)}>{CREW_CHEERS.find(cheer=>cheer.type===reaction)?.emoji}</span>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
  </div>;
}
