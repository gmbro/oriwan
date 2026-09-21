import FourthDashboardContent from "@/components/fourth-dashboard-content";
import { publicPageMetadata, publicSiteStructuredData } from "@/lib/public-site-metadata";
export const metadata={
 ...publicPageMetadata("창업가를 위한 심신단련 커뮤니티", "스내사, 스스로 내던지는 사람들. TWTT 아침러닝 챌린지는 창업가를 위한 심신단련 커뮤니티입니다. 트레바리 러닝·독서 모임과 100일 습관 챌린지를 만나보세요.", "/"),
 verification:{google:"fma-f5GwHyx3f0Ri4ExKmMzLiPKzDdUFj8wjJDA-QW4"},
};
export default function Home(){return <div className="min-h-dvh bg-[#f2f4f6] text-[#191f28]">
 <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(publicSiteStructuredData).replace(/</g,"\\u003c")}} />
 <FourthDashboardContent />

 </div>;}
