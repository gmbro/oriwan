import type { Metadata } from "next";
import { DashboardClient } from "@/app/dashboard/dashboard-client";
import { thirdSeasonSnapshot } from "@/lib/third-season-snapshot";

export const metadata: Metadata = {
  title: "TWTT 3기 기록",
  description: "TWTT 3기 공통 대시보드 읽기 전용 기록",
  alternates: { canonical: "/3th" },
};

export default function ThirdSeasonPage() {
  return (
    <DashboardClient
      initialData={thirdSeasonSnapshot}
      initialTodayIso={thirdSeasonSnapshot.to}
      announcementsEnabled={false}
      liveDataEnabled={false}
      topSlot={(
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-xs font-bold leading-5 text-blue-800 ring-1 ring-blue-100">
          3기 종료 시점의 공개 기록을 보관한 읽기 전용 화면입니다.
        </div>
      )}
    />
  );
}
