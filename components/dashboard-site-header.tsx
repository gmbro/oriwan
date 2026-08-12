import Image from "next/image";
import { DashboardSiteTabs } from "@/components/dashboard-site-tabs";

export function DashboardSiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-950/10 bg-[#101522]/96 px-3 pb-2.5 pt-2.5 text-white backdrop-blur-2xl sm:px-4 sm:pb-3 sm:pt-3">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative h-[38px] w-[38px] shrink-0 overflow-hidden rounded-2xl bg-lime-300">
            <Image src="/oriwan-logo-v2.png" alt="스내사 러닝보드" fill sizes="38px" className="object-cover" preload />
          </span>
          <h1 className="font-rounded-title truncate text-[24px] leading-none sm:text-[32px]">스내사 러닝보드</h1>
        </div>
        <DashboardSiteTabs />
      </div>
    </header>
  );
}
