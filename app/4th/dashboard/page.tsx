import type { Metadata } from "next";
import { connection } from "next/server";
import { Hello2027Poc } from "@/app/poc/hello-2027/hello-2027-poc";
import { FourthViewerProvider } from "@/components/fourth-viewer-provider";
import { SeasonReportAutoRefresh } from "@/components/season-report-auto-refresh";
import { getFourthViewer } from "@/lib/fourth-viewer-server";
import {
  getFreshHello2027DashboardSnapshot,
  getHello2027DashboardSnapshot,
} from "@/lib/hello-2027-dashboard-data";
import { toKstIsoDate } from "@/lib/run-records";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "TWTT 4기 · Hello 2027",
  description: "TWTT 4기 러닝 크루의 인증 현황과 활동 기록",
  alternates: { canonical: "/4th/dashboard" },
  robots: { index: false, follow: false },
};

export default async function FourthSeasonDashboardPage() {
  await connection();
  const currentDateIso = toKstIsoDate();
  // Resolve enrollment first. The verified-claims path is local for anonymous
  // and returning sessions, while this ordering prevents a fallback first-login
  // from populating the shared snapshot cache before its participant exists.
  const initialViewer = await getFourthViewer();
  const snapshot = initialViewer.dashboard_member_changed
    ? await getFreshHello2027DashboardSnapshot()
    : await getHello2027DashboardSnapshot();

  return (
    <FourthViewerProvider initialViewer={initialViewer}>
      <SeasonReportAutoRefresh intervalMs={60_000} />
      <Hello2027Poc
        snapshot={snapshot}
        currentDateIso={currentDateIso}
        memberFeatures
      />
    </FourthViewerProvider>
  );
}
