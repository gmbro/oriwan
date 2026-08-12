"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardSiteTabs() {
  const pathname = usePathname();
  const reportActive = pathname.startsWith("/dashboard/report");

  return (
    <nav className="mt-2 grid grid-cols-2 gap-1 rounded-2xl bg-white/8 p-1 ring-1 ring-white/10" aria-label="공통대시보드 메뉴">
      <Link
        href="/dashboard"
        prefetch
        aria-current={!reportActive ? "page" : undefined}
        className={`flex min-h-10 items-center justify-center rounded-xl px-2 text-center text-[11px] font-black transition-colors sm:text-xs ${
          !reportActive ? "bg-white text-slate-950 shadow-sm" : "text-white/65 hover:bg-white/10 hover:text-white"
        }`}
      >
        대시보드
      </Link>
      <Link
        href="/dashboard/report"
        prefetch
        aria-current={reportActive ? "page" : undefined}
        className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-center text-[11px] font-black transition-colors sm:text-xs ${
          reportActive ? "bg-lime-300 text-slate-950 shadow-sm" : "text-lime-200 hover:bg-white/10"
        }`}
      >
        100일 시즌 리포트
        {!reportActive && <span className="rounded-full bg-lime-300 px-1.5 py-0.5 text-[8px] text-slate-950">NEW</span>}
      </Link>
    </nav>
  );
}
