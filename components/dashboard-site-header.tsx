import { DashboardSiteTabs } from "@/components/dashboard-site-tabs";
import { TwttBrandMark } from "@/components/twtt-brand-mark";

export function DashboardSiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-950/10 bg-[#101522]/96 px-3 pb-2.5 pt-2.5 text-white backdrop-blur-2xl sm:px-4 sm:pb-3 sm:pt-3">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex min-w-0 items-center gap-3">
          <TwttBrandMark className="aspect-[640/310] w-[88px] sm:w-[104px]" sizes="(max-width: 640px) 88px, 104px" priority label="TWTT 러닝보드" />
          <h1 className="sr-only">TWTT 러닝보드</h1>
        </div>
        <DashboardSiteTabs />
      </div>
    </header>
  );
}
