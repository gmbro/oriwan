import type { Metadata } from "next";
import { connection } from "next/server";
import { Hello2027Poc } from "@/app/poc/hello-2027/hello-2027-poc";
import { FourthSeasonOpeningNotice } from "@/components/fourth-season-opening-notice";
import { FourthViewerProvider } from "@/components/fourth-viewer-provider";
import { getFourthViewer } from "@/lib/fourth-viewer-server";
import {
  getHello2027DashboardSnapshot,
  makeEmptyHello2027DashboardSnapshot,
} from "@/lib/hello-2027-dashboard-data";
import { toKstIsoDate } from "@/lib/run-records";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "TWTT 4기 · Hello 2027",
  description: "TWTT 4기 공통 대시보드 오픈 전 미리보기",
  alternates: { canonical: "/4th/dashboard" },
  robots: { index: false, follow: false },
};

export default async function FourthSeasonDashboardPage() {
  await connection();
  const initialViewer = await getFourthViewer();
  const currentDateIso = toKstIsoDate();
  const snapshot = initialViewer.authenticated
    ? makeEmptyHello2027DashboardSnapshot(currentDateIso)
    : await getHello2027DashboardSnapshot();

  return (
    <FourthViewerProvider initialViewer={initialViewer}>
      <Hello2027Poc
        snapshot={snapshot}
        currentDateIso={currentDateIso}
        memberFeatures
      />
      <FourthSeasonOpeningNotice />
    </FourthViewerProvider>
  );
}
