"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { IconArrowRight } from "@/components/icons";
import { MemberPictogram } from "@/components/member-pictogram";
import { SeasonMonthlyDistanceBars } from "@/components/season-report-visuals";
import {
  formatSeasonDuration,
  selectRecentSeasonBadges,
  type SeasonMemberReport,
} from "@/lib/season-report";
import { renderSeasonPosterBlob } from "@/lib/season-poster-canvas";

type MemberNavigatorItem = Pick<SeasonMemberReport, "id" | "name" | "pictogramIndex" | "theme" | "hasHundredDayBadge">;

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}

export function PersonalSeasonReport({ member, members }: { member: SeasonMemberReport; members: MemberNavigatorItem[] }) {
  const characterRef = useRef<HTMLDivElement>(null);
  const [busyAction, setBusyAction] = useState<"download" | "share" | null>(null);
  const [notice, setNotice] = useState("");

  const createPoster = async () => {
    const svg = characterRef.current?.querySelector("svg");
    const svgMarkup = svg ? new XMLSerializer().serializeToString(svg) : "";
    return renderSeasonPosterBlob(member, svgMarkup);
  };

  const fileName = () => safeFileName(`스내사_100일리포트_${member.name}_정사각형.png`);

  const downloadPoster = async () => {
    setBusyAction("download");
    setNotice("");
    try {
      const blob = await createPoster();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName();
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("2160×2160 고화질 PNG를 저장했습니다. iPhone은 다운로드 항목에서 사진 앱에 저장할 수 있어요.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "포스터 저장에 실패했습니다.");
    } finally {
      setBusyAction(null);
    }
  };

  const sharePoster = async () => {
    setBusyAction("share");
    setNotice("");
    try {
      const blob = await createPoster();
      const file = new File([blob], fileName(), { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${member.name}님의 스내사 100일 리포트`,
          text: member.statement,
        });
        setNotice("공유 메뉴에서 Instagram이나 사진 저장을 선택할 수 있어요.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName();
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("이 브라우저는 이미지 공유를 지원하지 않아 PNG로 저장했습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(error instanceof Error ? error.message : "포스터 공유에 실패했습니다.");
    } finally {
      setBusyAction(null);
    }
  };

  const recentBadges = selectRecentSeasonBadges(member.badges, 4);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-2.5 py-3 sm:px-4 sm:py-6">
      <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,680px)_minmax(300px,1fr)]">
        <article className="aspect-square w-full min-w-0 overflow-hidden rounded-[26px] bg-white p-4 text-slate-950 shadow-xl shadow-slate-950/8 ring-1 ring-slate-950/5 sm:rounded-[32px] sm:p-7">
          <div className="flex h-full min-h-0 flex-col">
            <header className="flex shrink-0 items-center justify-between gap-3 text-[8px] font-black tracking-wide text-slate-400 sm:text-[10px]">
              <span>@thosewhothrowthemselvesin</span>
              <span>2026.05.05–08.12</span>
            </header>

            <section className="mt-2 flex shrink-0 items-center justify-between gap-2 sm:mt-4 sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-[clamp(1.75rem,8vw,3.5rem)] font-black leading-none tracking-[-0.06em]">{member.name}</p>
              </div>
              <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-3">
                <p className="w-32 shrink-0 rounded-2xl bg-sky-50 px-2 py-1.5 text-[8px] font-bold leading-[1.35] text-sky-950 ring-1 ring-sky-100 sm:w-56 sm:px-3 sm:py-2.5 sm:text-[11px] sm:leading-[1.45]">
                  {member.cheerMessage}
                </p>
                <div ref={characterRef} className="flex h-16 w-16 shrink-0 items-center justify-center sm:h-24 sm:w-24">
                  <MemberPictogram
                    index={member.pictogramIndex}
                    participantName={member.name}
                    transparentBackground
                    className="!h-14 !w-14 sm:!h-20 sm:!w-20"
                  />
                </div>
              </div>
            </section>

            <section className="mt-3 grid shrink-0 grid-cols-2 gap-2 border-y border-slate-100 py-3 sm:mt-5 sm:gap-4 sm:py-4">
              {[
                ["총 인증일", `${member.certifiedDays}일`],
                ["누적 시간", formatSeasonDuration(member.durationSeconds)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-[8px] font-black text-slate-400 sm:text-[10px]">{label}</p>
                  <p className="mt-1 truncate text-lg font-black tabular-nums text-slate-950 sm:text-2xl">{value}</p>
                </div>
              ))}
            </section>

            <section className="mt-2 flex min-h-0 flex-1 flex-col sm:mt-4">
              <div className="flex shrink-0 items-end justify-between gap-2">
                <p className="text-[10px] font-black tracking-[0.08em] sm:text-sm">MONTH DISTANCE</p>
                <p className="text-[7px] font-bold text-slate-400 sm:text-[9px]">단위 km</p>
              </div>
              <div className="mt-1 min-h-0 flex-1 sm:mt-2">
                <SeasonMonthlyDistanceBars months={member.months} accent="#38bdf8" />
              </div>
            </section>

            <section className="mt-2 shrink-0 sm:mt-3">
              <div className="mb-1 flex items-center justify-between gap-2 sm:mb-2">
                <p className="text-[8px] font-black tracking-[0.08em] text-slate-500 sm:text-[10px]">PERSONAL TITLE</p>
                <p className="text-[7px] font-bold text-slate-400 sm:text-[9px]">획득일 기준 최신 4개</p>
              </div>
              <div className="grid grid-cols-4 gap-1 sm:gap-2">
                {recentBadges.map((badge) => (
                  <span
                    key={badge.key}
                    className={`flex min-h-7 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-1 text-center text-[7px] font-black tracking-[-0.03em] sm:min-h-9 sm:rounded-xl sm:px-2 sm:text-[10px] ${
                      badge.key === "hundred-day-streak" ? "bg-sky-100 text-blue-900" : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    {badge.key === "hundred-day-streak" ? "👑 " : ""}{badge.label}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </article>

        <aside className="min-w-0 pb-4 xl:sticky xl:top-32">
          <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 sm:p-5">
            <p className="text-base font-black text-slate-950">포스터 저장·공유</p>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">화면과 같은 1:1 비율의 2160px 고화질 PNG로 저장합니다.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={downloadPoster}
                disabled={busyAction !== null}
                className="min-h-12 rounded-2xl bg-slate-950 px-3 text-sm font-black text-lime-200 shadow-lg shadow-slate-950/15 disabled:opacity-50"
              >
                {busyAction === "download" ? "이미지 만드는 중…" : "사진으로 저장"}
              </button>
              <button
                type="button"
                onClick={sharePoster}
                disabled={busyAction !== null}
                className="min-h-12 rounded-2xl bg-lime-300 px-3 text-sm font-black text-slate-950 shadow-lg shadow-lime-300/20 disabled:opacity-50"
              >
                {busyAction === "share" ? "공유 준비 중…" : "공유하기"}
              </button>
            </div>
            {notice && <p role="status" className="mt-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-[10px] font-bold leading-5 text-slate-600">{notice}</p>}
          </section>

          <section className="mt-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 sm:p-5">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-sm font-black text-slate-950">다른 크루의 100일</p>
                <p className="mt-1 text-[10px] font-bold text-slate-500">캐릭터를 눌러 바로 이동하세요.</p>
              </div>
              <Link href="/dashboard/report" className="inline-flex items-center gap-1 text-[10px] font-black text-lime-700">전체 <IconArrowRight size={13} /></Link>
            </div>
            <div className="-mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
              <Link href="/dashboard/report" className="flex w-16 shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl bg-slate-950 px-2 py-3 text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime-300 text-[10px] font-black text-slate-950">ALL</span>
                <span className="text-[9px] font-black">전체</span>
              </Link>
              {members.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/report/${item.id}`}
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
