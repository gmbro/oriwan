"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("TWTT route render failed", error.digest ?? "unknown");
  }, [error.digest]);

  return (
    <main className="grid min-h-screen min-h-svh place-items-center bg-[#f4f7fb] px-4 py-10 text-slate-950">
      <section className="w-full max-w-[480px] rounded-[30px] bg-white p-6 text-center shadow-[0_20px_60px_rgba(27,45,74,0.12)] ring-1 ring-slate-950/5 sm:p-9" aria-labelledby="route-error-title">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-2xl" aria-hidden="true">↻</span>
        <h1 id="route-error-title" className="mt-5 text-2xl font-black tracking-[-0.03em]">화면을 불러오지 못했어요</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">잠시 연결이 불안정할 수 있어요. 다시 시도해도 계속되면 대시보드 입구로 돌아가 주세요.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={reset} className="min-h-12 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white">다시 시도</button>
          <Link href="/4th" className="flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-700">처음으로</Link>
        </div>
      </section>
    </main>
  );
}
