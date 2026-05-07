"use client";

import { useEffect, useState } from "react";
import { IconYoutube } from "@/components/icons";
import { getCuratedYoutubeShortTips, tipCategoryLabels, youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube-shorts";
import type { TipCategory, YoutubeShortTip } from "@/lib/youtube-shorts";

const categoryOptions: TipCategory[] = ["running", "stretching", "recovery"];
const TIP_LIMIT = 10;

type TipsResponse = {
  tips?: YoutubeShortTip[];
};

export function YoutubeShortsSection() {
  const [category, setCategory] = useState<TipCategory>("running");
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [selectedTip, setSelectedTip] = useState<YoutubeShortTip | null>(null);
  const [tips, setTips] = useState<YoutubeShortTip[]>(() => getCuratedYoutubeShortTips("running", 0, TIP_LIMIT));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedTip) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTip(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedTip]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTips() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          category,
          seed: String(refreshSeed),
          limit: String(TIP_LIMIT),
        });
        const response = await fetch(`/api/youtube-shorts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = (await response.json()) as TipsResponse;
        if (!response.ok || !json.tips?.length) throw new Error("shorts_fetch_failed");
        setTips(json.tips.slice(0, TIP_LIMIT));
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setTips(getCuratedYoutubeShortTips(category, refreshSeed, TIP_LIMIT));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadTips();
    return () => controller.abort();
  }, [category, refreshSeed]);

  return (
    <section className="mt-4 card overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black text-rose-600 ring-1 ring-rose-100">
            <IconYoutube size={14} /> Shorts
          </p>
          <h3 className="mt-2 text-lg font-black tracking-[-0.03em] text-oriwan-text">오늘의 러닝 충전소</h3>
          <p className="mt-1 text-xs leading-5 text-oriwan-text-muted">러닝, 스트레칭, 리커버리 쇼츠를 가볍게 넘기며 컨디션을 채워요.</p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 overflow-x-auto rounded-full bg-oriwan-surface-light p-1 ring-1 ring-slate-950/5">
            {categoryOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setCategory(option);
                  setRefreshSeed((value) => value + 1);
                }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${
                  category === option ? "bg-slate-950 text-lime-200 shadow-sm" : "text-oriwan-text-muted hover:text-oriwan-text"
                }`}
              >
                {tipCategoryLabels[option]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRefreshSeed((value) => value + 1)}
            className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-oriwan-text ring-1 ring-slate-950/10 transition hover:bg-lime-100"
          >
            {loading ? "찾는 중" : "새 팁 보기"}
          </button>
        </div>
      </div>

      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {tips.map((tip) => (
          <button
            key={tip.id}
            type="button"
            onClick={() => setSelectedTip(tip)}
            className="group min-w-[210px] max-w-[210px] snap-start overflow-hidden rounded-[24px] bg-slate-950 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-950/10 sm:min-w-[240px] sm:max-w-[240px]"
          >
            <div className="relative aspect-[9/12] overflow-hidden bg-gradient-to-br from-slate-900 via-[#26351d] to-slate-950 p-4">
              <img
                src={tip.thumbnailUrl || youtubeThumbnailUrl(tip.id)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/15 via-slate-950/20 to-slate-950/90" />
              <div className="absolute right-3 top-3 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-lime-200 ring-1 ring-white/10">
                {tip.tag}
              </div>
              <div className="absolute inset-x-4 bottom-4">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/45">{tipCategoryLabels[tip.category]}</p>
                <p className="mt-1 text-2xl font-black leading-tight tracking-[-0.05em]">{tip.title}</p>
                <p className="mt-3 text-xs font-bold text-white/50">{tip.channel}</p>
              </div>
              <div className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-lg">
                <IconYoutube size={22} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedTip && (
        <div
          className="fixed inset-0 z-[90] flex items-end bg-slate-950/70 px-4 py-4 backdrop-blur-sm sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedTip.title} 영상 보기`}
          onClick={() => setSelectedTip(null)}
        >
          <div className="w-full max-w-[420px] overflow-hidden rounded-[28px] bg-[#101522] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{selectedTip.title}</p>
                <p className="truncate text-[11px] font-bold text-white/45">{selectedTip.channel}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTip(null)}
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white/70 transition hover:text-white"
              >
                닫기
              </button>
            </div>
            <div className="aspect-[9/16] bg-black">
              <iframe
                key={selectedTip.id}
                src={youtubeEmbedUrl(selectedTip.id)}
                title={selectedTip.title}
                className="h-full w-full"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <a
              href={youtubeWatchUrl(selectedTip.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 text-center text-xs font-black text-lime-200 transition hover:bg-white/5"
            >
              YouTube Shorts로 이어보기
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
