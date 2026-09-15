import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import { EVENT_ID, readSeasonEvents } from "@/lib/season-schedule-storage";
export const dynamic = "force-dynamic";
export const metadata = { title: "스내사 4기 모임 안내" };
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params; if(!EVENT_ID.test(id)) notFound();
 const service=getServiceClient(); if(!service) throw new Error("일정 저장소를 연결할 수 없어요.");
 const owner=await findAdminUserId(service); if(!owner) notFound();
 const event=(await readSeasonEvents(service,owner)).find(item=>item.id===id); if(!event) notFound();
 const auth=await createClient(); const {data}=await auth.auth.getClaims();
 if(!data?.claims?.sub) return <article className="rounded-3xl bg-white p-6"><h1 className="text-2xl font-bold">{event.title}</h1><Link href="/4th/dashboard#schedule" className="mt-5 inline-block text-blue-600">← 일정으로 돌아가기</Link></article>;
 const date=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date(event.date+"T00:00:00+09:00"));
 return <><Link href="/4th/dashboard#schedule" className="text-sm font-semibold text-blue-600">← 일정으로 돌아가기</Link><article className="mt-6 rounded-3xl bg-white p-6 sm:p-10"><p className="text-sm font-bold text-blue-600">스내사 4기 · 모임 안내</p><h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight">{event.title}</h1><dl className="my-7 grid gap-4 rounded-2xl bg-slate-50 p-5 text-sm"><div><dt className="text-slate-500">날짜</dt><dd className="mt-1 font-semibold">{date}{event.endDate ? ` ~ ${event.endDate}` : ""}</dd></div><div><dt className="text-slate-500">시간</dt><dd className="mt-1 font-semibold">{event.time||"추후 안내"}{event.endTime?` ~ ${event.endTime}`:""}</dd></div><div><dt className="text-slate-500">장소</dt><dd className="mt-1 font-semibold">{event.location||"추후 안내"}</dd></div></dl><h2 className="mb-4 text-lg font-bold">모임 소개</h2><div className="space-y-5 leading-8 text-slate-600">{event.description.split(/\n\n+/).map((paragraph,index)=><p key={index} className="whitespace-pre-wrap break-words">{paragraph}</p>)}</div></article></>;
}
