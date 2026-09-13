"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SeasonEvent } from "@/lib/season-schedule-contract";
import styles from "@/app/poc/hello-2027/hello-2027-poc.module.css";

export function SeasonSchedule({ today }: { today: string }) {
  const initial = today < "2026-09-01" ? "2026-09-01" : today > "2026-12-31" ? "2026-12-31" : today;
  const [month, setMonth] = useState(initial.slice(0,7));
  const [selected, setSelected] = useState(initial);
  const [items, setItems] = useState<SeasonEvent[]>([]);
  const [status, setStatus] = useState("일정을 불러오는 중…");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/hello-2027/schedule", { signal: controller.signal, cache: "no-store" }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setItems(body.items); setStatus("");
    }).catch(error => { if (error.name !== "AbortError") setStatus("일정을 불러오지 못했어요."); });
    return () => controller.abort();
  }, [retry]);
  const first = new Date(`${month}-01T00:00:00Z`);
  const days = new Date(Date.UTC(2026, Number(month.slice(5)), 0)).getUTCDate();
  const daily = items.filter(item => item.date === selected);
  function move(delta: number) {
    const next = `2026-${String(Number(month.slice(5)) + delta).padStart(2,"0")}`;
    setMonth(next); setSelected(today.startsWith(next) ? today : `${next}-01`);
  }
  return <section id="schedule" className={styles.crewSection} aria-labelledby="schedule-title">
    <div className={styles.crewHeading}><div><h2 id="schedule-title">일정</h2><p className="mt-2 text-sm text-slate-500">정기모임 및 번개 일정을 공유합니다</p></div></div>
    <div className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between"><button type="button" aria-label="이전 달" disabled={month === "2026-09"} onClick={()=>move(-1)} className="h-11 w-11 rounded-full bg-slate-50 disabled:opacity-25">‹</button><h3 className="text-lg font-bold">2026년 {Number(month.slice(5))}월</h3><button type="button" aria-label="다음 달" disabled={month === "2026-12"} onClick={()=>move(1)} className="h-11 w-11 rounded-full bg-slate-50 disabled:opacity-25">›</button></div>
      <div className="grid grid-cols-7 text-center text-xs text-slate-500">{["일","월","화","수","목","금","토"].map(day=><span key={day} className="pb-3">{day}</span>)}</div>
      <div className="grid grid-cols-7 border-t border-slate-200">{Array.from({length:first.getUTCDay()},(_,i)=><div className="min-h-24 border-b border-slate-100 sm:min-h-32" key={`blank-${i}`}/>)}{Array.from({length:days},(_,i)=>{
        const date = `${month}-${String(i+1).padStart(2,"0")}`; const events=items.filter(event=>event.date===date);
        return <div key={date} className={`min-w-0 border-b border-slate-100 px-0.5 pb-2 sm:px-2 ${selected===date?"bg-blue-50/60":""}`}><button type="button" aria-label={`2026년 ${Number(month.slice(5))}월 ${i+1}일${date===today?", 오늘":""}, 일정 ${events.length}개`} aria-pressed={selected===date} aria-current={date===today?"date":undefined} onClick={()=>setSelected(date)} className={`my-1 flex h-9 w-full items-center justify-center rounded-xl text-sm ${date===today?"bg-blue-600 font-bold text-white":"text-slate-700"}`}>{i+1}</button><div className="min-h-12 space-y-1 sm:min-h-20">{events.map(event=><Link key={event.id} href={`/schedule/${event.id}`} className="block break-words rounded-md bg-blue-100 px-1 py-1.5 text-[10px] font-semibold leading-4 text-blue-700 sm:px-2 sm:text-xs" title={event.title}>{event.title}</Link>)}</div></div>;
      })}</div>
      <div className="mt-5 border-t border-slate-100 pt-5" aria-live="polite"><h3 className="mb-3 font-bold">{Number(selected.slice(5,7))}월 {Number(selected.slice(8))}일 일정</h3>{status?<p className="text-sm text-slate-500">{status}{status.includes("못했")&&<button type="button" className="ml-3 text-blue-600" onClick={()=>{setStatus("일정을 불러오는 중…");setRetry(n=>n+1);}}>다시 시도</button>}</p>:daily.length?daily.map(event=><article key={event.id} className="mb-3 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-blue-600">{event.time||"시간 추후 안내"}{event.endTime?` ~ ${event.endTime}`:""}</p><Link href={`/schedule/${event.id}`} className="mt-1 block font-bold text-blue-600">{event.title} →</Link>{event.location&&<p className="mt-2 text-sm text-slate-600">{event.location}</p>}{event.description&&<p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{event.description}</p>}</article>):<p className="text-sm text-slate-500">등록된 일정이 없어요.</p>}</div>
    </div>
  </section>;
}
