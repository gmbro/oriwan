import { connection } from "next/server";
import { DashboardClient } from "@/app/dashboard/dashboard-client";
import { getPublicDashboardDateRange, getPublicDashboardPayload, type PublicDashboardPayload } from "@/lib/public-dashboard-data";

async function getInitialDashboardData() {
  await connection();
  const { from, to, cacheKey } = getPublicDashboardDateRange({ scope: "all" });

  try {
    const { payload } = await getPublicDashboardPayload(cacheKey, from, to);
    return { initialData: payload, initialError: "", initialTodayIso: to };
  } catch (error) {
    console.error("Dashboard initial data error:", error);
    return {
      initialData: null as PublicDashboardPayload | null,
      initialError: "팀 보드를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      initialTodayIso: to,
    };
  }
}

export default async function DashboardPage() {
  const { initialData, initialError, initialTodayIso } = await getInitialDashboardData();
  return <DashboardClient initialData={initialData} initialError={initialError} initialTodayIso={initialTodayIso} />;
}
