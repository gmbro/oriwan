import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DashboardGatewayActions, DashboardGatewayAuthNotice } from "@/components/dashboard-gateway-actions";
import { FourthViewerProvider } from "@/components/fourth-viewer-provider";
import { TwttBrandMark } from "@/components/twtt-brand-mark";

export const metadata: Metadata = {
  title: "TWTT 4기 공통 대시보드",
  description: "TWTT 4기 공통 대시보드 입구",
  alternates: { canonical: "/4th" },
  robots: { index: false, follow: false },
};

export default function FourthSeasonGatewayPage() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-oriwan-bg px-3 py-6 sm:px-5 sm:py-10">
      <div className="relative mx-auto w-full max-w-[440px]">
        <div className="card mobile-page-card p-6 sm:p-9">
          <div className="animate-fade-up flex justify-center">
            <TwttBrandMark className="aspect-[640/310] w-[clamp(164px,46vw,196px)]" sizes="196px" priority />
          </div>

          <h1 className="sr-only">TWTT 4기 공통 대시보드 입구</h1>
          <div className="animate-fade-up mt-7" style={{ animationDelay: "0.1s" }}>
            <Suspense fallback={null}>
              <DashboardGatewayAuthNotice />
            </Suspense>
            <FourthViewerProvider>
              <DashboardGatewayActions />
            </FourthViewerProvider>
          </div>
        </div>

        <div className="animate-fade-up mt-5 flex items-center justify-center gap-3 text-[11px] text-oriwan-text-muted/50" style={{ animationDelay: "0.26s" }}>
          <Link href="/terms" className="underline underline-offset-2 transition-colors hover:text-oriwan-text-muted">
            이용약관
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" className="underline underline-offset-2 transition-colors hover:text-oriwan-text-muted">
            개인정보처리방침
          </Link>
        </div>
      </div>
    </main>
  );
}
