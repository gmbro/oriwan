import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DashboardGatewayActions, DashboardGatewayAuthNotice } from "@/components/dashboard-gateway-actions";
import { FourthViewerProvider } from "@/components/fourth-viewer-provider";
import { TwttBrandMark } from "@/components/twtt-brand-mark";
import { getFourthViewer } from "@/lib/fourth-viewer-server";

export const metadata: Metadata = {
  title: "TWTT 4기 시작",
  description: "TWTT 4기 로그인 및 공통 대시보드 입구",
  alternates: { canonical: "/4th" },
  robots: { index: false, follow: false },
};

export default async function FourthSeasonGatewayPage() {
  await connection();
  const initialViewer = await getFourthViewer();

  if (initialViewer.authenticated) {
    redirect("/4th/dashboard#member-features");
  }

  return (
    <main className="grid min-h-dvh grid-rows-[1fr_auto] overflow-x-hidden bg-[#f4f7fb] px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-5 sm:pb-8 sm:pt-10">
      <section className="flex items-center justify-center py-8 sm:py-10" aria-labelledby="gateway-title">
        <div className="relative mx-auto w-full max-w-[440px]">
          <div className="card mobile-page-card border border-slate-950/[0.04] bg-white p-6 shadow-[0_20px_55px_rgba(23,43,77,0.10)] sm:p-9">
            <div className="animate-fade-up flex justify-center">
              <TwttBrandMark className="aspect-[640/310] w-[clamp(164px,46vw,196px)]" sizes="196px" priority />
            </div>

            <p className="animate-fade-up mt-3 text-center text-sm font-black text-slate-800 sm:text-base" style={{ animationDelay: "0.06s" }}>
              스스로 내던지는 사람들 4기
            </p>
            <h1 id="gateway-title" className="sr-only">TWTT 4기 대시보드 입구</h1>

            <div className="animate-fade-up mt-6" style={{ animationDelay: "0.1s" }}>
              <Suspense fallback={null}>
                <DashboardGatewayAuthNotice />
              </Suspense>
              <FourthViewerProvider initialViewer={initialViewer}>
                <DashboardGatewayActions />
              </FourthViewerProvider>
            </div>
          </div>
        </div>
      </section>

      <footer className="animate-fade-up flex flex-col items-center justify-center gap-2 text-[11px] font-semibold text-slate-400" style={{ animationDelay: "0.2s" }}>
        <p>(주)아키랩</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/terms" className="underline underline-offset-2 transition-colors hover:text-slate-600">
            이용약관
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" className="underline underline-offset-2 transition-colors hover:text-slate-600">
            개인정보처리방침
          </Link>
        </div>
      </footer>
    </main>
  );
}
