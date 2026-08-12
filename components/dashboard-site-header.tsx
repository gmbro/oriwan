import Image from "next/image";
import Link from "next/link";

export function DashboardSiteHeader({ active }: { active: "dashboard" | "report" }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-950/10 bg-[#101522]/96 px-3 pb-2.5 pt-2.5 text-white backdrop-blur-2xl sm:px-4 sm:pb-3 sm:pt-3">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/oriwan-logo-v2.png" alt="스내사 러닝보드" width={38} height={38} className="rounded-2xl bg-lime-300" priority />
          <h1 className="font-rounded-title truncate text-[24px] leading-none sm:text-[32px]">스내사 러닝보드</h1>
        </div>
        <nav className="mt-2 grid grid-cols-2 gap-1 rounded-2xl bg-white/8 p-1 ring-1 ring-white/10" aria-label="공통대시보드 메뉴">
          <Link
            href="/dashboard"
            aria-current={active === "dashboard" ? "page" : undefined}
            className={`flex min-h-10 items-center justify-center rounded-xl px-2 text-center text-[11px] font-black transition sm:text-xs ${
              active === "dashboard" ? "bg-white text-slate-950 shadow-sm" : "text-white/65 hover:bg-white/10 hover:text-white"
            }`}
          >
            오늘의 대시보드
          </Link>
          <Link
            href="/dashboard/report"
            aria-current={active === "report" ? "page" : undefined}
            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-center text-[11px] font-black transition sm:text-xs ${
              active === "report" ? "bg-lime-300 text-slate-950 shadow-sm" : "text-lime-200 hover:bg-white/10"
            }`}
          >
            100일 시즌 리포트
            {active !== "report" && <span className="rounded-full bg-lime-300 px-1.5 py-0.5 text-[8px] text-slate-950">NEW</span>}
          </Link>
        </nav>
      </div>
    </header>
  );
}
