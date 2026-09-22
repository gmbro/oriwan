"use client";
import { usePathname, useRouter } from "next/navigation";

export function SpectatorNavigation() {
  const path = usePathname();
  const router = useRouter();
  if (!["/about", "/running-community", "/habit-challenge"].includes(path) && !path.startsWith("/magazine")) return null;
  return <button type="button" onClick={() => {
    if (window.history.length > 1) router.back();
    else router.replace("/");
  }} className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-500">
    <span aria-hidden="true">←</span> 뒤로 돌아가기
  </button>;
}
