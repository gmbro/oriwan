import type { Metadata } from "next";
import FourthDashboardContent from "@/components/fourth-dashboard-content";
export const revalidate = 60;

export const metadata: Metadata = {
  title: "TWTT 4기 · Hello 2027",
  description: "TWTT 4기 러닝 크루의 인증 현황과 활동 기록",
  alternates: { canonical: "/4th/dashboard" },
  robots: { index: false, follow: false },
};

export default FourthDashboardContent;
