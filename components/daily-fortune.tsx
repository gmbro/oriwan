"use client";

import { useEffect, useState } from "react";

type FortuneResponse = {
  date: string;
  fortune: {
    title: string;
    message: string;
    keyword: string;
    action: string;
    color: string;
  };
  disclaimer: string;
};

export function DailyFortune() {
  const [data, setData] = useState<FortuneResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/me/fortune", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => ({ response, json: await response.json() }))
      .then(({ response, json }) => {
        if (!active) return;
        if (!response.ok) {
          setError(json.error || "오늘의 운세를 불러오지 못했어요.");
          return;
        }
        setData(json);
        setError("");
      })
      .catch(() => {
        if (active) setError("오늘의 운세를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#6c5ce7] via-[#4f6fe7] to-[#3182f6] p-5 text-white shadow-xl shadow-indigo-500/15 sm:p-6" aria-labelledby="daily-fortune-title">
      <div className="pointer-events-none absolute -right-9 -top-12 h-40 w-40 rounded-full border-[26px] border-white/10" aria-hidden="true" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-white/70">TODAY&apos;S FORTUNE</p>
            <h2 id="daily-fortune-title" className="mt-1 text-xl font-black sm:text-2xl">오늘의 운세</h2>
          </div>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl ring-1 ring-white/20" aria-hidden="true">✨</span>
        </div>

        {loading ? (
          <div className="mt-5 space-y-3" aria-label="오늘의 운세를 불러오는 중">
            <div className="h-7 w-3/4 animate-pulse rounded-full bg-white/20" />
            <div className="h-16 animate-pulse rounded-2xl bg-white/10" />
          </div>
        ) : error ? (
          <p className="mt-5 rounded-2xl bg-white/12 px-4 py-3 text-sm font-bold leading-6" role="status">{error}</p>
        ) : data ? (
          <>
            <h3 className="mt-5 text-[clamp(1.35rem,5vw,1.8rem)] font-black leading-tight">{data.fortune.title}</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/90">{data.fortune.message}</p>
            <dl className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/10">
                <dt className="text-[11px] font-black text-white/85">행운 키워드</dt>
                <dd className="mt-1 text-sm font-black">{data.fortune.keyword}</dd>
              </div>
              <div className="rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/10">
                <dt className="text-[11px] font-black text-white/85">오늘의 색</dt>
                <dd className="mt-1 text-sm font-black">{data.fortune.color}</dd>
              </div>
            </dl>
            <div className="mt-2 rounded-2xl bg-white px-4 py-3 text-indigo-700">
              <p className="text-[10px] font-black text-indigo-400">행운 루틴</p>
              <p className="mt-1 text-sm font-black leading-5">{data.fortune.action}</p>
            </div>
            <p className="mt-4 text-[11px] font-bold leading-5 text-white/85">{data.disclaimer}</p>
          </>
        ) : null}
      </div>
    </section>
  );
}
