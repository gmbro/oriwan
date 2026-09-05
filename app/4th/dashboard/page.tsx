import type { Metadata } from "next";
import { connection } from "next/server";
import { Hello2027Poc } from "@/app/poc/hello-2027/hello-2027-poc";
import { FourthSeasonOpeningNotice } from "@/components/fourth-season-opening-notice";
import { FourthViewerProvider } from "@/components/fourth-viewer-provider";
import { SeasonReportAutoRefresh } from "@/components/season-report-auto-refresh";
import { getFourthViewer } from "@/lib/fourth-viewer-server";
import {
  getHello2027DashboardSnapshot,
} from "@/lib/hello-2027-dashboard-data";
import { toKstIsoDate } from "@/lib/run-records";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "TWTT 4기 · Hello 2027",
  description: "TWTT 4기 공통 대시보드 운영 준비 화면",
  alternates: { canonical: "/4th/dashboard" },
  robots: { index: false, follow: false },
};

export default async function FourthSeasonDashboardPage() {
  await connection();
  const currentDateIso = toKstIsoDate();
  const [initialViewer, snapshot] = await Promise.all([
    getFourthViewer(),
    getHello2027DashboardSnapshot(),
  ]);

  return (
    <FourthViewerProvider initialViewer={initialViewer}>
      <SeasonReportAutoRefresh intervalMs={60_000} />
      <Hello2027Poc
        snapshot={snapshot}
        currentDateIso={currentDateIso}
        memberFeatures
      />
      <FourthSeasonOpeningNotice />
    </FourthViewerProvider>
  );
}
