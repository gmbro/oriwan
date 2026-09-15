"use client";
import { useEffect, useRef, useState } from "react";
import { usePageScrollLock } from "@/lib/use-page-scroll-lock";
import modalStyles from "./season-schedule.module.css";
import type { SeasonEvent } from "@/lib/season-schedule-contract";
import styles from "@/app/poc/hello-2027/hello-2027-poc.module.css";

export function SeasonSchedule({ today, authenticated = false }: { today: string; authenticated?: boolean }) {
  const initial = today < "2026-09-01" ? "2026-09-01" : today > "2027-01-01" ? "2027-01-01" : today;
  const [month, setMonth] = useState(initial.slice(0,7));
  const [selected, setSelected] = useState(initial);
  const [opened, setOpened] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  usePageScrollLock(opened);
  useEffect(() => { if (opened) dialog.current?.showModal(); else dialog.current?.close(); }, [opened]);
  const [detailsAllowed,setDetailsAllowed] = useState(false);
  const [items, setItems] = useState<SeasonEvent[]>([]);
  const [status, setStatus] = useState("일정을 불러오는 중…");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/hello-2027/schedule", { signal: controller.signal, cache: "no-store" }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setItems(body.items); setDetailsAllowed(Boolean(body.canViewDetails)); setStatus("");
    }).catch(error => { if (error.name !== "AbortError") setStatus("일정을 불러오지 못했어요."); });
    return () => controller.abort();
  }, [retry, authenticated]);
  const first = new Date(`${month}-01T00:00:00Z`);
  const days = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5)), 0)).getUTCDate();
  const daily = items.filter(item => item.date <= selected && (item.endDate || item.date) >= selected && (!eventId || item.id === eventId));
  function move(delta: number) {
    const next = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5))-1+delta, 1)).toISOString().slice(0,7);
    setMonth(next); setSelected(today.startsWith(next) ? today : `${next}-01`);
  }
  return <section id="schedule" className={styles.crewSection} aria-labelledby="schedule-title">
    <div className={styles.crewHeading}><div><h2 id="schedule-title">일정</h2><p className="mt-2 text-sm text-slate-500">정기모임 및 번개 일정을 공유합니다</p></div></div>
    <div className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-2 flex items-center justify-between"><button type="button" aria-label="이전 달" disabled={month === "2026-09"} onClick={()=>move(-1)} className="h-11 w-11 rounded-full bg-slate-50 disabled:opacity-25">‹</button><h3 className="text-lg font-bold">{month.slice(0,4)}년 {Number(month.slice(5))}월</h3><button type="button" aria-label="다음 달" disabled={month === "2027-01"} onClick={()=>move(1)} className="h-11 w-11 rounded-full bg-slate-50 disabled:opacity-25">›</button></div>
      <div className="grid grid-cols-7 text-center text-xs text-slate-500">{["일","월","화","수","목","금","토"].map(day=><span key={day} className="pb-2">{day}</span>)}</div>
      <div className="grid grid-cols-7">{Array.from({length:first.getUTCDay()},(_,i)=><div className="h-11" key={`blank-${i}`}/>)}{Array.from({length:days},(_,i)=>{
        const date = `${month}-${String(i+1).padStart(2,"0")}`;
        const events=items.filter(event=>event.date<=date && (event.endDate||event.date)>=date);
        return <button key={date} type="button" aria-label={`${month.slice(0,4)}년 ${Number(month.slice(5))}월 ${i+1}일${date===today?", 오늘":""}, 일정 ${events.length}개`} aria-haspopup={events.length ? "dialog" : undefined} aria-current={date===today?"date":undefined} onClick={()=>{setSelected(date);setEventId(null);if(events.length) setOpened(true);}} className="flex h-11 min-w-0 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-blue-500"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${date===today?"bg-blue-600 font-bold text-white":"text-slate-700"} ${events.length?"ring-2 ring-blue-400 ring-offset-2":""}`}>{i+1}</span></button>;
      })}</div>
      {status && <p role="status" className="mt-4 text-sm text-slate-500">{status}{status.includes("못했") && <button type="button" className="ml-3 min-h-11 text-blue-600" onClick={()=>{setStatus("일정을 불러오는 중…");setRetry(n=>n+1);}}>다시 시도</button>}</p>}
      <dialog ref={dialog} className={modalStyles.dialog} aria-labelledby="schedule-dialog-title" onCancel={e=>{e.preventDefault();setOpened(false);}} onClose={()=>setOpened(false)} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setOpened(false);}}>
        <header className={modalStyles.heading}><h2 id="schedule-dialog-title">{Number(selected.slice(5,7))}월 {Number(selected.slice(8))}일 일정</h2><button type="button" autoFocus aria-label="일정 닫기" onClick={()=>setOpened(false)}>×</button></header>
        <div className={modalStyles.body}>{daily.map(event=><article key={event.id}><h3>{event.title}</h3>{authenticated&&detailsAllowed&&<><dl><div><dt>날짜</dt><dd>{event.date}{event.endDate ? ` ~ ${event.endDate}` : ""}</dd></div><div><dt>시간</dt><dd>{event.time||"추후 안내"}{event.endTime?` ~ ${event.endTime}`:""}</dd></div><div><dt>장소</dt><dd>{event.location||"추후 안내"}</dd></div></dl>{event.description&&<p>{event.description}</p>}</>}</article>)}</div>
      </dialog>
    </div>
  </section>;
}
