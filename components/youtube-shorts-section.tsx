"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { IconX, IconYoutube } from "@/components/icons";
import { getCuratedYoutubeShortTips, tipCategoryLabels, youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube-shorts";
import type { TipCategory, YoutubeShortTip } from "@/lib/youtube-shorts";

const categoryOptions: TipCategory[] = ["running", "stretching", "recovery"];
const TIP_LIMIT = 10;
const SHORTS_SEEN_STORAGE_KEY = "oriwan-youtube-shorts-seen-v2";

type TipsResponse = {
  tips?: YoutubeShortTip[];
  nextCursor?: string;
  source?: "youtube" | "curated";
};

type SeenStore = {
  dayKey: string;
  seenIdsByCategory: Record<TipCategory, string[]>;
};

function makeEmptySeenIds(): Record<TipCategory, string[]> {
  return { running: [], stretching: [], recovery: [] };
}

function makeEmptyCursors(): Record<TipCategory, string> {
  return { running: "", stretching: "", recovery: "" };
}

function getKstDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateSeed(dayKey: string) {
  return Number(dayKey.replace(/\D/g, "")) || 0;
}

function loadSeenStore(dayKey: string): Record<TipCategory, string[]> {
  if (typeof window === "undefined") return makeEmptySeenIds();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SHORTS_SEEN_STORAGE_KEY) || "{}") as Partial<SeenStore>;
    if (parsed.dayKey !== dayKey || !parsed.seenIdsByCategory) return makeEmptySeenIds();
    return {
      running: parsed.seenIdsByCategory.running || [],
      stretching: parsed.seenIdsByCategory.stretching || [],
      recovery: parsed.seenIdsByCategory.recovery || [],
    };
  } catch {
    return makeEmptySeenIds();
  }
}

function saveSeenStore(dayKey: string, seenIdsByCategory: Record<TipCategory, string[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SHORTS_SEEN_STORAGE_KEY, JSON.stringify({ dayKey, seenIdsByCategory }));
}

function appendUniqueIds(current: string[], nextTips: YoutubeShortTip[]) {
  return Array.from(new Set([...current, ...nextTips.map((tip) => tip.id)])).slice(-1000);
}

export function YoutubeShortsSection() {
  const initialDayKey = getKstDateKey();
  const seenIdsRef = useRef<Record<TipCategory, string[]>>(loadSeenStore(initialDayKey));
  const cursorRef = useRef<Record<TipCategory, string>>(makeEmptyCursors());
  const [category, setCategory] = useState<TipCategory>("running");
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [dayKey, setDayKey] = useState(initialDayKey);
  const [selectedTip, setSelectedTip] = useState<YoutubeShortTip | null>(null);
  const [tips, setTips] = useState<YoutubeShortTip[]>(() => getCuratedYoutubeShortTips("running", dateSeed(initialDayKey), TIP_LIMIT));
  const [loading, setLoading] = useState(false);
  const [brokenThumbnailIds, setBrokenThumbnailIds] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedTip) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTip(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedTip]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const nextSeenIds = loadSeenStore(dayKey);
      seenIdsRef.current = nextSeenIds;
      cursorRef.current = makeEmptyCursors();
    });
    return () => cancelAnimationFrame(frame);
  }, [dayKey]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextDayKey = getKstDateKey();
      if (nextDayKey === dayKey) return;
      seenIdsRef.current = makeEmptySeenIds();
      cursorRef.current = makeEmptyCursors();
      saveSeenStore(nextDayKey, seenIdsRef.current);
      setDayKey(nextDayKey);
      setRefreshSeed((value) => value + 1);
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [dayKey]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTips() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          category,
          seed: String(refreshSeed),
          limit: String(TIP_LIMIT),
          day: dayKey,
        });
        const seenIds = seenIdsRef.current[category] || [];
        const cursor = cursorRef.current[category] || "";
        if (cursor) params.set("cursor", cursor);
        if (seenIds.length) params.set("seen", seenIds.slice(-240).join(","));
        const response = await fetch(`/api/youtube-shorts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = (await response.json()) as TipsResponse;
        if (!response.ok || !json.tips?.length) throw new Error("shorts_fetch_failed");
        const nextTips = json.tips.slice(0, TIP_LIMIT);
        seenIdsRef.current = {
          ...seenIdsRef.current,
          [category]: appendUniqueIds(seenIdsRef.current[category] || [], nextTips),
        };
        cursorRef.current = {
          ...cursorRef.current,
          [category]: json.nextCursor || "",
        };
        saveSeenStore(dayKey, seenIdsRef.current);
        setTips(nextTips);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        const fallbackTips = getCuratedYoutubeShortTips(category, dateSeed(dayKey) + refreshSeed, TIP_LIMIT)
          .filter((tip) => !(seenIdsRef.current[category] || []).includes(tip.id));
        setTips(fallbackTips.length ? fallbackTips : getCuratedYoutubeShortTips(category, refreshSeed, TIP_LIMIT));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadTips();
    return () => controller.abort();
  }, [category, dayKey, refreshSeed]);

  return (
    <section className="card mobile-page-card mt-4 overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-black leading-tight text-oriwan-text">오늘의 러닝상식</h3>
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
            className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-oriwan-text ring-1 ring-slate-950/5 transition hover:bg-lime-50"
          >
            {loading ? "찾는 중" : "다음 쇼츠"}
          </button>
        </div>
      </div>

      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {tips.map((tip) => {
          const thumbnailBroken = brokenThumbnailIds.includes(tip.id);
          return (
          <button
            key={tip.id}
            type="button"
            onClick={() => setSelectedTip(tip)}
            className="group min-w-[210px] max-w-[210px] snap-start overflow-hidden rounded-[24px] bg-slate-950 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-950/10 sm:min-w-[240px] sm:max-w-[240px]"
          >
            <div className="relative aspect-[9/12] overflow-hidden bg-gradient-to-br from-slate-900 via-[#26351d] to-slate-950 p-4">
              {!thumbnailBroken && (
                <Image
                  src={tip.thumbnailUrl || youtubeThumbnailUrl(tip.id)}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 210px, 240px"
                  className="object-cover opacity-70 transition duration-500 group-hover:scale-105"
                  loading="lazy"
                  onError={() => {
                    setBrokenThumbnailIds((current) => (
                      current.includes(tip.id) ? current : [...current, tip.id]
                    ));
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/15 via-slate-950/20 to-slate-950/90" />
              {thumbnailBroken && (
                <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(190,242,100,0.28),transparent_34%),linear-gradient(145deg,#101522,#314322_52%,#0f172a)]">
                  <IconYoutube size={54} />
                </div>
              )}
              <div className="absolute right-3 top-3 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-lime-200 ring-1 ring-white/10">
                {tip.tag}
              </div>
              <div className="absolute inset-x-4 bottom-4">
                <p className="text-[11px] font-black uppercase text-white/45">{tipCategoryLabels[tip.category]}</p>
                <p className="mt-1 text-2xl font-black leading-tight">{tip.title}</p>
                <p className="mt-3 text-xs font-bold text-white/50">{tip.channel}</p>
              </div>
              <div className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-lg">
                <IconYoutube size={22} />
              </div>
            </div>
          </button>
          );
        })}
      </div>

      {selectedTip && (
        <div
          className="fixed inset-0 z-[90] flex items-end bg-slate-950/70 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedTip.title} 영상 보기`}
          onClick={() => setSelectedTip(null)}
        >
          <div className="mobile-sheet w-full max-w-[420px] overflow-hidden bg-[#101522] shadow-2xl sm:rounded-[28px]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{selectedTip.title}</p>
                <p className="truncate text-[11px] font-bold text-white/45">{selectedTip.channel}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTip(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:text-white"
                aria-label="닫기"
              >
                <IconX size={17} />
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
