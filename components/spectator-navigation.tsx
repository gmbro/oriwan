"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SpectatorNavigation() {
  const path = usePathname();
  if (!["/about", "/running-community", "/habit-challenge"].includes(path) && !path.startsWith("/magazine")) return null;
  return <Link href="/" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-500">
    <span aria-hidden="true">←</span> 홈으로 돌아가기
  </Link>;
}
