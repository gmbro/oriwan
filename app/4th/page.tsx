import type { Metadata } from "next";
import { FourthSeasonOpeningNotice } from "@/components/fourth-season-opening-notice";
import { Hello2027Poc } from "@/app/poc/hello-2027/hello-2027-poc";
import { hello2027Snapshot } from "@/app/poc/hello-2027/hello-2027-poc-data";
import { FourthViewerProvider } from "@/components/fourth-viewer-provider";

export const metadata: Metadata = {
  title: "TWTT 4기 · Hello 2027",
  description: "TWTT 4기 공통 대시보드 오픈 전 미리보기",
  alternates: { canonical: "/4th" },
  robots: { index: false, follow: false },
};

export default function FourthSeasonPage() {
  return (
    <FourthViewerProvider>
      <Hello2027Poc
        snapshot={hello2027Snapshot}
        memberFeatures
      />
      <FourthSeasonOpeningNotice />
    </FourthViewerProvider>
  );
}
