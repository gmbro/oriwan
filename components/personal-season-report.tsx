"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconArrowRight } from "@/components/icons";
import { MemberPictogram } from "@/components/member-pictogram";
import { SeasonMonthlyDistanceBars } from "@/components/season-report-visuals";
import {
  selectRecentSeasonBadges,
  type SeasonMemberReport,
} from "@/lib/season-report";

type PersonalSeasonReportMember = Pick<
  SeasonMemberReport,
  "id" | "name" | "pictogramIndex" | "cheerMessage" | "certifiedDays" | "distanceKm" | "durationSeconds" | "months" | "badges"
>;

type MemberNavigatorItem = Pick<SeasonMemberReport, "id" | "name" | "pictogramIndex">;

const PREPARED_PHOTO_CACHE_LIMIT = 6;
const preparedPhotoCache = new Map<string, Blob>();

function readPreparedPhoto(cacheKey: string) {
  const cached = preparedPhotoCache.get(cacheKey);
  if (!cached) return null;
  preparedPhotoCache.delete(cacheKey);
  preparedPhotoCache.set(cacheKey, cached);
  return cached;
}

function writePreparedPhoto(cacheKey: string, blob: Blob) {
  preparedPhotoCache.delete(cacheKey);
  preparedPhotoCache.set(cacheKey, blob);
  while (preparedPhotoCache.size > PREPARED_PHOTO_CACHE_LIMIT) {
    const oldestKey = preparedPhotoCache.keys().next().value;
    if (!oldestKey) break;
    preparedPhotoCache.delete(oldestKey);
  }
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}

function formatSeasonDurationEnglish(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}M`;
  if (!minutes) return `${hours.toLocaleString("en-US")}H`;
  return `${hours.toLocaleString("en-US")}H ${minutes}M`;
}

function BadgeCrownIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 shrink-0" fill="none">
      <path d="M2.2 5.2 5 7.4 8 2.6l3 4.8 2.8-2.2-1.1 7H3.3l-1.1-7Z" fill="currentColor" />
      <path d="M3.5 13.2h9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  );
}

function waitForPosterPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

export function PersonalSeasonReport({ member, members }: { member: PersonalSeasonReportMember; members: MemberNavigatorItem[] }) {
  const posterRef = useRef<HTMLElement>(null);
  const preparedPhotoRef = useRef<Blob | null>(null);
  const saveInFlightRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);
  const [showDownloadFallback, setShowDownloadFallback] = useState(false);
  const [notice, setNotice] = useState("");

  const createPoster = useCallback(async () => {
    const poster = posterRef.current;
    if (!poster) throw new Error("리포트 화면을 준비하지 못했습니다.");

    if (document.fonts) {
      const fontFamily = window.getComputedStyle(poster).fontFamily;
      await Promise.all([
        document.fonts.ready,
        document.fonts.load(`900 64px ${fontFamily}`, `0123456789km${member.name}`).catch(() => []),
      ]);
    }
    await waitForPosterPaint();

    const posterRect = poster.getBoundingClientRect();
    if (!posterRect.width || !posterRect.height) throw new Error("리포트 화면 크기를 확인하지 못했습니다.");
    const canvasWidth = 1080;
    const canvasHeight = Math.round(canvasWidth * (posterRect.height / posterRect.width));
    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(poster, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      canvasWidth,
      canvasHeight,
      pixelRatio: 2,
      skipAutoScale: true,
    });
    if (!blob) throw new Error("리포트 사진을 만들지 못했습니다.");
    return blob;
  }, [member.id, member.name]);

  const fileName = () => safeFileName(`report_${member.name}.png`);

  const downloadPhoto = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  useEffect(() => {
    const poster = posterRef.current;
    if (!poster) return;

    let cancelled = false;
    let prepareTimer: number | undefined;
    let idleHandle: number | undefined;
    let preparationSequence = 0;
    let lastPreparedWidth = 0;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const cacheKeyForWidth = (width: number) => (
      `${member.id}:${member.certifiedDays}:${member.distanceKm}:${member.durationSeconds}:${width}`
    );
    const initialWidth = Math.round(poster.getBoundingClientRect().width);
    const initialCachedPhoto = initialWidth ? readPreparedPhoto(cacheKeyForWidth(initialWidth)) : null;
    preparedPhotoRef.current = initialCachedPhoto;
    lastPreparedWidth = initialCachedPhoto ? initialWidth : 0;
    setPhotoReady(Boolean(initialCachedPhoto));
    setShowDownloadFallback(false);
    setNotice("");

    const preparePhoto = async () => {
      const width = Math.round(poster.getBoundingClientRect().width);
      if (!width || (width === lastPreparedWidth && preparedPhotoRef.current)) return;
      const cacheKey = cacheKeyForWidth(width);
      const cachedPhoto = readPreparedPhoto(cacheKey);
      if (cachedPhoto) {
        preparedPhotoRef.current = cachedPhoto;
        lastPreparedWidth = width;
        setPhotoReady(true);
        return;
      }
      const sequence = ++preparationSequence;
      preparedPhotoRef.current = null;
      setPhotoReady(false);
      setShowDownloadFallback(false);
      setNotice("");
      try {
        const blob = await createPoster();
        if (cancelled || sequence !== preparationSequence) return;
        preparedPhotoRef.current = blob;
        writePreparedPhoto(cacheKey, blob);
        lastPreparedWidth = width;
        setPhotoReady(true);
      } catch (error) {
        if (cancelled || sequence !== preparationSequence) return;
        setNotice(error instanceof Error ? error.message : "리포트 사진을 준비하지 못했습니다.");
      }
    };

    const schedulePreparation = () => {
      if (prepareTimer !== undefined) window.clearTimeout(prepareTimer);
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(() => {
          idleHandle = undefined;
          void preparePhoto();
        }, { timeout: 1000 });
        return;
      }
      prepareTimer = window.setTimeout(() => void preparePhoto(), 350);
    };
    const resizeObserver = new ResizeObserver(schedulePreparation);
    resizeObserver.observe(poster);
    schedulePreparation();

    return () => {
      cancelled = true;
      preparationSequence += 1;
      resizeObserver.disconnect();
      if (prepareTimer !== undefined) window.clearTimeout(prepareTimer);
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      preparedPhotoRef.current = null;
    };
  }, [createPoster, member.certifiedDays, member.distanceKm, member.durationSeconds, member.id]);

  const savePosterAsPhoto = async () => {
    const blob = preparedPhotoRef.current;
    if (!blob || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setNotice("");
    setShowDownloadFallback(false);

    const photo = new File([blob], fileName(), { type: "image/png" });
    const shareData = {
      files: [photo],
      title: `${member.name} 100일 리포트`,
    };
    const canSharePhoto = typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [photo] });

    if (!canSharePhoto) {
      downloadPhoto(blob);
      saveInFlightRef.current = false;
      return;
    }

    let pendingShare: Promise<void>;
    try {
      pendingShare = navigator.share(shareData);
    } catch (error) {
      saveInFlightRef.current = false;
      setShowDownloadFallback(true);
      setNotice(error instanceof Error ? error.message : "사진 저장 메뉴를 열지 못했습니다.");
      return;
    }

    setSaving(true);
    try {
      await pendingShare;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShowDownloadFallback(true);
      setNotice("사진 저장 메뉴를 열지 못했어요. 아래 PNG 다운로드를 이용해주세요.");
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  const recentBadges = selectRecentSeasonBadges(member.badges, 4);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:py-6">
      <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,680px)_minmax(300px,1fr)]">
        <article ref={posterRef} data-season-poster className="w-full max-w-[680px] min-w-0 justify-self-center rounded-[26px] bg-white p-4 text-slate-950 shadow-xl shadow-slate-950/8 ring-1 ring-slate-950/5 max-[359px]:p-3 sm:rounded-[32px] sm:p-7">
          <div className="flex min-w-0 flex-col">
            <header className="flex shrink-0 items-center justify-between gap-2 text-[8px] font-black tracking-wide text-slate-400 sm:text-[10px]">
              <a
                href="https://www.instagram.com/thosewhothrowthemselvesin/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="인스타그램 @thosewhothrowthemselvesin 프로필 열기(새 탭)"
                className="min-w-0 truncate text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-950"
              >
                @thosewhothrowthemselvesin
              </a>
              <span className="shrink-0">2026.05.05–08.12</span>
            </header>

            <section className="mt-2 flex shrink-0 items-center justify-between gap-2 max-[359px]:mt-1.5 max-[359px]:gap-1 sm:mt-4 sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-[clamp(1.75rem,8vw,3.5rem)] font-black leading-none tracking-[-0.06em]">{member.name}</p>
              </div>
              <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-3">
                <p className="w-32 shrink-0 rounded-2xl bg-sky-50 px-2 py-1.5 text-[8px] font-bold leading-[1.35] text-sky-950 ring-1 ring-sky-100 max-[359px]:w-28 max-[359px]:text-[7px] sm:w-56 sm:px-3 sm:py-2.5 sm:text-[11px] sm:leading-[1.45]">
                  {member.cheerMessage}
                </p>
                <div className="flex h-16 w-16 shrink-0 items-center justify-center max-[359px]:h-14 max-[359px]:w-14 sm:h-24 sm:w-24">
                  <MemberPictogram
                    index={member.pictogramIndex}
                    participantName={member.name}
                    transparentBackground
                    className="!h-14 !w-14 max-[359px]:!h-12 max-[359px]:!w-12 sm:!h-20 sm:!w-20"
                  />
                </div>
              </div>
            </section>

            <section data-total-distance className="mt-2 shrink-0 max-[359px]:mt-1.5 sm:mt-4">
              <p className="text-[8px] font-black text-slate-400 sm:text-[10px]">TOTAL DISTANCE</p>
              <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5 sm:mt-1 sm:gap-2">
                <strong className="min-w-0 whitespace-nowrap text-[clamp(3rem,17vw,6rem)] font-black leading-[0.82] !tracking-[-0.055em] tabular-nums text-slate-950">
                  {member.distanceKm.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </strong>
                <span className="shrink-0 text-sm font-black text-slate-400 sm:text-xl">km</span>
              </div>
            </section>

            <section className="mt-3 grid shrink-0 grid-cols-2 gap-2 border-y border-slate-100 py-3 max-[359px]:mt-2 max-[359px]:py-2 sm:mt-5 sm:gap-4 sm:py-4">
              {[
                ["TOTAL CERTIFIED DAYS", `${member.certifiedDays} DAYS`],
                ["TOTAL TIME", formatSeasonDurationEnglish(member.durationSeconds)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="whitespace-nowrap text-[7px] font-black text-slate-400 sm:text-[10px]">{label}</p>
                  <p className="mt-1 whitespace-nowrap text-lg font-black tabular-nums text-slate-950 max-[359px]:text-base sm:text-2xl">{value}</p>
                </div>
              ))}
            </section>

            <section data-season-chart className="mt-2 flex h-28 shrink-0 flex-col min-[360px]:h-32 sm:mt-4 sm:h-64">
              <div className="flex shrink-0 items-end justify-between gap-2">
                <p className="text-[10px] font-black tracking-[0.08em] sm:text-sm">MONTH DISTANCE</p>
                <p className="text-[7px] font-bold text-slate-400 sm:text-[9px]">단위 km</p>
              </div>
              <div className="mt-1 min-h-0 flex-1 overflow-hidden sm:mt-2">
                <SeasonMonthlyDistanceBars months={member.months} accent="#38bdf8" />
              </div>
            </section>

            <section data-personal-title-section className="mt-2 min-h-[41px] shrink-0 pb-1.5 sm:mt-3 sm:min-h-[54px] sm:pb-2">
              <div className="mb-1 flex items-center justify-between gap-2 sm:mb-2">
                <p className="text-[8px] font-black tracking-[0.08em] text-slate-500 sm:text-[10px]">PERSONAL TITLE</p>
                <p className="text-[7px] font-bold text-slate-400 sm:text-[9px]">획득일 기준 최신 4개</p>
              </div>
              <div className="grid grid-cols-4 gap-1 sm:gap-2">
                {recentBadges.map((badge) => (
                  <span
                    key={badge.key}
                    data-personal-badge
                    className={`flex min-h-7 min-w-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-lg px-1 text-center text-[7px] font-black !tracking-[-0.03em] sm:min-h-9 sm:rounded-xl sm:px-2 sm:text-[10px] ${
                      badge.key === "hundred-day-streak" ? "bg-sky-100 text-blue-900" : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    {badge.key === "hundred-day-streak" && <BadgeCrownIcon />}
                    <span className="min-w-0 truncate">{badge.label}</span>
                  </span>
                ))}
              </div>
            </section>
          </div>
        </article>

        <aside className="w-full max-w-[680px] min-w-0 justify-self-center pb-4 xl:sticky xl:top-32 xl:max-w-none">
          <section className="rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-slate-950/5 sm:p-4">
            <button
              type="button"
              onClick={savePosterAsPhoto}
              disabled={!photoReady || saving}
              aria-busy={saving}
              className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-lime-200 shadow-lg shadow-slate-950/15 transition-colors hover:bg-slate-800 disabled:cursor-wait"
            >
              {saving ? "저장 메뉴 여는 중…" : "사진 앱에 저장"}
            </button>
            <p className="mt-2 text-center text-[9px] font-bold leading-4 text-slate-500">
              모바일에서는 열린 메뉴에서 ‘이미지 저장’을 선택해주세요.
            </p>
            {showDownloadFallback && preparedPhotoRef.current && (
              <button
                type="button"
                onClick={() => downloadPhoto(preparedPhotoRef.current!)}
                className="mt-2 flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-100 px-4 text-xs font-black text-slate-700 transition hover:bg-slate-200"
              >
                PNG 파일 다운로드
              </button>
            )}
            {notice && <p role="alert" className="mt-2 rounded-2xl bg-rose-50 px-3 py-2.5 text-[10px] font-bold leading-5 text-rose-700">{notice}</p>}
          </section>

          <section className="mt-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 sm:p-5">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-sm font-black text-slate-950">다른 크루의 100일</p>
                <p className="mt-1 text-[10px] font-bold text-slate-500">캐릭터를 눌러 바로 이동하세요.</p>
              </div>
              <Link href="/dashboard/report" className="inline-flex items-center gap-1 text-[10px] font-black text-lime-700">전체 <IconArrowRight size={13} /></Link>
            </div>
            <div className="-mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-2 pt-2">
              <Link href="/dashboard/report" prefetch className="flex w-16 shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl bg-slate-950 px-2 py-3 text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime-300 text-[10px] font-black text-slate-950">ALL</span>
                <span className="text-[9px] font-black">전체</span>
              </Link>
              {members.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/report/${item.id}`}
                  prefetch
                  aria-current={item.id === member.id ? "page" : undefined}
                  className={`flex w-16 shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl px-2 py-3 ring-1 ${item.id === member.id ? "bg-lime-50 ring-lime-300" : "bg-slate-50 ring-slate-950/5"}`}
                >
                  <MemberPictogram index={item.pictogramIndex} participantName={item.name} className="!h-9 !w-9" />
                  <span className="max-w-full truncate text-[9px] font-black text-slate-950">{item.name}</span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
