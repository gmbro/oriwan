import FourthDashboardContent from "@/components/fourth-dashboard-content";
import { publicPageMetadata, publicSiteStructuredData } from "@/lib/public-site-metadata";
export const metadata={
 ...publicPageMetadata("스내사 | 창업가 러닝 커뮤니티 · 100일 습관 챌린지", "스내사(스스로 내던지는 사람들)는 창업가와 예비 창업자가 함께 달리고, 읽고, 실천하는 커뮤니티입니다. TWTT 100일 러닝 습관 챌린지와 운동 인증, 독서 모임을 만나보세요.", "/"),
 verification:{google:"fma-f5GwHyx3f0Ri4ExKmMzLiPKzDdUFj8wjJDA-QW4"},
};
export default function Home(){return <div className="min-h-dvh bg-[#f2f4f6] text-[#191f28]">
 <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(publicSiteStructuredData).replace(/</g,"\\u003c")}} />
 <FourthDashboardContent />

 </div>;}
