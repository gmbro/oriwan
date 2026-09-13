"use client";
import { useRef } from "react";
import { DailyGiftBox } from "@/components/daily-gift-box";
export function GiftPreview() {
 const dialog = useRef<HTMLDialogElement>(null);
 return <main style={{minHeight:"100dvh",background:"#f2f4f6",padding:24,display:"grid",placeContent:"center",gap:20}}><h1>오늘의 응원 상자 · 로컬 미리보기</h1><p>예시 인증 완료 상태예요. 실제 선물 수령이나 서버 저장은 하지 않아요.</p><button className="rounded-2xl bg-blue-600 p-4 font-bold text-white" onClick={()=>dialog.current?.showModal()}>오늘의 응원 상자</button><dialog ref={dialog} className="m-auto w-[min(420px,calc(100%-32px))] rounded-3xl p-6 backdrop:bg-black/30"><button aria-label="응원 상자 닫기" className="float-right p-2" onClick={()=>dialog.current?.close()}>×</button><DailyGiftBox preview initialStatus={{eligible:true,participant_name:"러너",record_date:"2026-10-08",claim:null}} /></dialog></main>;
}
