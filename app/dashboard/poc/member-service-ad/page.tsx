import type { Metadata } from "next";
import { connection } from "next/server";
import { DashboardClient } from "@/app/dashboard/dashboard-client";
import { MemberServiceAdPocBanner } from "@/components/member-service-ad-poc-banner";
import { getPublicDashboardDateRange, getPublicDashboardPayload, type PublicDashboardPayload } from "@/lib/public-dashboard-data";

export const metadata: Metadata = {
  title: "멤버 서비스 광고 POC | 스내사 러닝보드",
  description: "대시보드 상단 멤버 서비스 광고 구좌 예시 화면입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

async function getPocDashboardData() {
  await connection();
  const { from, to, cacheKey } = getPublicDashboardDateRange({ scope: "all" });

  try {
    const { payload } = await getPublicDashboardPayload(cacheKey, from, to);
    return { initialData: payload, initialError: "", initialTodayIso: to };
  } catch (error) {
    console.error("Dashboard POC initial data error:", error);
    return {
      initialData: null as PublicDashboardPayload | null,
      initialError: "팀 보드를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      initialTodayIso: to,
    };
  }
}

export default async function MemberServiceAdPocPage() {
  const { initialData, initialError, initialTodayIso } = await getPocDashboardData();

  return (
    <DashboardClient
      initialData={initialData}
      initialError={initialError}
      initialTodayIso={initialTodayIso}
      announcementsEnabled={false}
      topSlot={<MemberServiceAdPocBanner />}
    />
  );
}
