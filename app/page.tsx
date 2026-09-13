import Link from "next/link";
import type { Metadata } from "next";
const site="https://xn--220bw61afob.kro.kr";
export const metadata:Metadata={
 title:"스내사 | 스스로 내던지는 사람들 · TWTT 아침 러닝 챌린지",
 description:"스내사는 스스로 내던지는 사람들의 러닝 커뮤니티입니다. TWTT 스내사 4기 100일 도전, 오전 8시 이전 운동 시작 인증, 공동 거리 목표와 참여 방법을 알아보세요.",
 verification:{google:"fma-f5GwHyx3f0Ri4ExKmMzLiPKzDdUFj8wjJDA-QW4"},
 alternates:{canonical:"/"},robots:{index:true,follow:true},
 openGraph:{title:"스내사 · 스스로 내던지는 사람들",description:"함께 달리고, 인증하고, 응원하는 TWTT 100일 도전",url:site,type:"website",images:[{url:"/brand/twtt-logo.png",width:640,height:310,alt:"TWTT"}]},
};
export default function Home(){return <main className="min-h-dvh bg-[#f2f4f6] text-[#191f28]">
 <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5"><Link href="/" className="text-2xl font-black">TWTT</Link><Link href="/4th/dashboard" className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-600">대시보드 보기</Link></header>
 <div className="mx-auto max-w-4xl space-y-6 px-6 pb-16">
 <section className="rounded-3xl bg-white px-6 py-12 sm:p-12"><p className="mb-4 font-bold text-blue-600">스스로 내던지는 사람들</p><h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">스내사<br/>함께 시작하는 아침</h1><p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">스내사는 스스로 내던지는 사람들의 러닝 커뮤니티입니다. TWTT에서 하루의 운동을 기록하고, 서로의 꾸준함을 응원하며 함께 목표를 향해 나아갑니다.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/4th/dashboard" className="rounded-2xl bg-blue-600 px-5 py-4 font-bold text-white">4기 대시보드 보기</Link><a href="#participate" className="rounded-2xl bg-blue-50 px-5 py-4 font-bold text-blue-600">참여 방법 알아보기</a></div></section>
 <section className="rounded-3xl bg-white p-6 sm:p-10"><h2 className="text-2xl font-bold">스내사 4기 · 100일의 도전</h2><p className="mt-4 leading-8 text-slate-600">2026년 9월 23일부터 12월 31일까지, 하루하루 운동한 기록을 쌓는 도전입니다. 첫 공동 목표는 다 같이 1,000km 달성하기입니다. 운영자가 승인한 러닝 거리가 쌓이면 다음 목표가 열립니다.</p><p className="mt-3 leading-8 text-slate-600">대시보드에서는 공동 인증 현황과 목표를 확인할 수 있어요. 개인별 상세 기록은 로그인 후 볼 수 있으며, 인증 원본은 공개 소개 페이지에 표시하지 않습니다.</p></section>
 <section id="participate" className="rounded-3xl bg-white p-6 sm:p-10"><h2 className="text-2xl font-bold">스내사 참여 방법</h2><ol className="mt-5 list-inside list-decimal space-y-4 leading-7 text-slate-600"><li>참가 전 운영자에게 현재 모집 여부와 참여 조건을 확인해주세요.</li><li>참여할 준비가 되면 대시보드에서 카카오로 로그인해주세요. 로그인 후 운영자가 승인하면 4기 멤버로 참여할 수 있습니다.</li><li>운동 날짜·시작 시각·거리가 보이는 캡처를 인증 메뉴에 올려주세요.</li><li>운영자가 확인한 기록이 공식 인증에 반영됩니다.</li></ol></section>
 <section className="rounded-3xl bg-white p-6 sm:p-10"><h2 className="text-2xl font-bold">자주 묻는 질문</h2><div className="mt-5 space-y-6 leading-7"><div><h3 className="font-bold">스내사는 무슨 뜻인가요?</h3><p className="mt-2 text-slate-600">‘스스로 내던지는 사람들’을 줄인 이름입니다. TWTT 안에서 함께 운동하고 기록하는 도전입니다.</p></div><div><h3 className="font-bold">인증 사진은 언제 올려야 하나요?</h3><p className="mt-2 text-slate-600">오전 8시 이전에 운동을 시작했다는 시각이 보이도록 올려주세요. 업로드한 시간보다 캡처에 표시된 운동 날짜와 시작 시각을 확인하며, 운영자가 최종 승인합니다.</p></div><div><h3 className="font-bold">로그인 없이 구경할 수 있나요?</h3><p className="mt-2 text-slate-600">공개 소개와 대시보드의 공동 현황은 볼 수 있습니다. 다른 멤버의 상세 기록을 보려면 로그인이 필요합니다.</p></div><div><h3 className="font-bold">교정운동도 문의할 수 있나요?</h3><p className="mt-2 text-slate-600">참여 회원은 내 정보의 교정운동 메뉴에서 운영자에게 문의할 수 있습니다. 제공 방식과 일정은 운영자에게 확인해주세요.</p></div></div></section>
 <footer className="flex flex-wrap gap-5 py-4 text-sm text-slate-600"><Link href="/4th/dashboard">스내사 대시보드</Link><Link href="/support">후원</Link><Link href="/privacy">개인정보처리방침</Link><Link href="/terms">이용약관</Link></footer>
 </div></main>;}
