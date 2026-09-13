import FourthDashboardContent from "@/components/fourth-dashboard-content";
import type { Metadata } from "next";
const site="https://xn--220bw61afob.kro.kr";
export const metadata:Metadata={
 title:"스내사 | 스스로 내던지는 사람들 · TWTT 아침 러닝 챌린지",
 description:"스내사는 스스로 내던지는 사람들의 러닝 커뮤니티입니다. TWTT 스내사 4기 100일 도전, 오전 8시 이전 운동 시작 인증, 공동 거리 목표와 참여 방법을 알아보세요.",
 verification:{google:"fma-f5GwHyx3f0Ri4ExKmMzLiPKzDdUFj8wjJDA-QW4"},
 alternates:{canonical:"/"},robots:{index:true,follow:true},
 openGraph:{title:"스내사 · 스스로 내던지는 사람들",description:"함께 달리고, 인증하고, 응원하는 TWTT 100일 도전",url:site,type:"website",images:[{url:"/brand/twtt-logo.png",width:640,height:310,alt:"TWTT"}]},
};
export default function Home(){return <div className="min-h-dvh bg-[#f2f4f6] text-[#191f28]">
 <FourthDashboardContent />

 </div>;}
