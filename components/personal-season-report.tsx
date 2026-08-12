"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { IconArrowRight } from "@/components/icons";
import { MemberPictogram } from "@/components/member-pictogram";
import { SeasonCalendar, SeasonCalendarLegend, SeasonMonthlyBars, SeasonWeeklyBars } from "@/components/season-report-visuals";
import { formatSeasonDuration, type SeasonMemberReport } from "@/lib/season-report";
import { renderSeasonPosterBlob, type SeasonPosterFormat } from "@/lib/season-poster-canvas";

type MemberNavigatorItem = Pick<SeasonMemberReport, "id" | "name" | "pictogramIndex" | "theme" | "hasHundredDayBadge">;

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}

export function PersonalSeasonReport({ member, members }: { member: SeasonMemberReport; members: MemberNavigatorItem[] }) {
  const characterRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<SeasonPosterFormat>("story");
  const [busyAction, setBusyAction] = useState<"download" | "share" | null>(null);
  const [notice, setNotice] = useState("");

  const createPoster = async () => {
    const svg = characterRef.current?.querySelector("svg");
    const svgMarkup = svg ? new XMLSerializer().serializeToString(svg) : "";
    return renderSeasonPosterBlob(member, format, svgMarkup);
  };

  const fileName = () => safeFileName(`스내사_100일리포트_${member.name}_${format === "story" ? "스토리" : "피드"}.png`);

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
      setNotice("고화질 PNG를 저장했습니다. iPhone은 다운로드 항목에서 사진 앱에 저장할 수 있어요.");
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
        setNotice("공유 메뉴에서 Instagram 스토리나 사진 저장을 선택할 수 있어요.");
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

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-0 py-0 sm:px-4 sm:py-7">
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,620px)_minmax(300px,1fr)]">
        <article
          className="relative w-full min-w-0 overflow-hidden text-white shadow-2xl shadow-slate-950/20 sm:rounded-[34px]"
          style={{ background: `linear-gradient(155deg, ${member.theme.background}, ${member.theme.surface})` }}
        >
          <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full opacity-15 blur-3xl" style={{ backgroundColor: member.theme.accent }} />
          <div className="relative p-4 pb-6 sm:p-7 sm:pb-8">
            <div className="flex items-center justify-between gap-3 text-[9px] font-black tracking-normal text-white/45 sm:text-[10px]">
              <span>SNESA · 100 DAYS RUNNING</span>
              <span>2026.05.05–08.12</span>
            </div>

            <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:mt-8 sm:gap-5">
              <div className="min-w-0">
                <p className="text-[10px] font-black" style={{ color: member.theme.accent }}>{member.theme.eyebrow}</p>
                <h2 className="font-rounded-title mt-1 truncate text-[clamp(2.5rem,13vw,5.2rem)] leading-none text-white">{member.name}</h2>
                <span className="mt-3 inline-flex rounded-full px-3 py-1.5 text-[11px] font-black" style={{ backgroundColor: member.theme.accent, color: member.theme.background }}>
                  {member.theme.label}
                </span>
              </div>
              <div ref={characterRef} className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-white/8 ring-1 ring-white/10 sm:h-40 sm:w-40">
                <MemberPictogram index={member.pictogramIndex} participantName={member.name} className="!h-24 !w-24 sm:!h-36 sm:!w-36" />
                {member.recentBadge && (
                  <span className={`absolute -bottom-2 left-1/2 flex max-w-[150px] -translate-x-1/2 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-black shadow-lg ${
                    member.recentBadge.key === "hundred-day-streak" ? "bg-sky-300 text-blue-950" : "bg-white text-slate-950"
                  }`}>
                    {member.recentBadge.key === "hundred-day-streak" && <span className="mr-1">👑</span>}
                    <span className="truncate">{member.recentBadge.label}</span>
                  </span>
                )}
              </div>
            </div>
            <p className="mt-6 max-w-md break-keep text-xl font-black leading-8 text-white sm:text-2xl sm:leading-9">{member.statement}</p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                ["총 인증일", `${member.certifiedDays}/100일`],
                ["누적 거리", `${member.distanceKm.toFixed(1)}km`],
                ["누적 시간", formatSeasonDuration(member.durationSeconds)],
                ["최장 연속 인증", `${member.longestStreak}일`],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-2xl bg-white/8 px-3 py-3 ring-1 ring-white/10 sm:px-4 sm:py-4">
                  <p className="text-[9px] font-black text-white/45">{label}</p>
                  <p className="mt-1 truncate text-xl font-black sm:text-2xl" style={{ color: member.theme.accent }}>{value}</p>
                </div>
              ))}
            </div>

            <section className="mt-4 rounded-[24px] bg-white/6 p-3 ring-1 ring-white/10 sm:p-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-black">인증한 날짜</p>
                  <p className="mt-1 text-[9px] font-bold text-white/45">작은 금색 점은 뱃지를 획득한 날이에요.</p>
                </div>
                <SeasonCalendarLegend />
              </div>
              <SeasonCalendar months={member.calendarMonths} />
            </section>

            <section className="mt-3 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[24px] bg-white/6 p-3 ring-1 ring-white/10 sm:p-4">
                <div className="flex items-end justify-between gap-2">
                  <p className="text-sm font-black">주간 리듬</p>
                  <p className="text-[9px] font-black" style={{ color: member.theme.accent }}>{member.bestWeekLabel}</p>
                </div>
                <SeasonWeeklyBars weeks={member.weeks} accent={member.theme.accent} compact />
              </div>
              <div className="rounded-[24px] bg-white/6 p-3 ring-1 ring-white/10 sm:p-4">
                <p className="mb-5 text-sm font-black">월간 흐름</p>
                <SeasonMonthlyBars months={member.months} accent={member.theme.accent} />
              </div>
            </section>

            <section className="mt-3 rounded-[24px] bg-white/6 p-3 ring-1 ring-white/10 sm:p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-black">최근 획득 뱃지</p>
                  <p className="mt-1 text-[9px] font-bold text-white/45">실제 획득일 기준 최신순</p>
                </div>
                <span className="text-[10px] font-black text-white/50">총 {member.badges.length}개</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {member.badges.slice(0, 3).map((badge) => (
                  <div key={badge.key} className={`min-w-0 rounded-2xl px-2 py-3 ${badge.key === "hundred-day-streak" ? "bg-sky-300 text-blue-950" : "bg-white/8 text-white"}`}>
                    <p className="truncate text-[10px] font-black">{badge.key === "hundred-day-streak" ? "👑 " : ""}{badge.label}</p>
                    <p className={`mt-1 text-[8px] font-bold ${badge.key === "hundred-day-streak" ? "text-blue-900/65" : "text-white/40"}`}>{badge.earnedDate ? badge.earnedDate.slice(5).replace("-", ".") : "획득"}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-[9px] font-black text-white/45">
              <span>스내사 러닝보드</span>
              <span>{member.favoriteWeekday} 러너 · 리커버리 {member.recoveryUsageCount}회</span>
            </div>
          </div>
        </article>

        <aside className="min-w-0 px-3 pb-6 sm:px-0 lg:sticky lg:top-32">
          <section className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 sm:p-5">
            <p className="text-base font-black text-slate-950">포스터 저장·공유</p>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">모바일 사진첩과 Instagram에 맞는 고화질 PNG를 만들어요.</p>
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
              {([
                ["story", "스토리 9:16"],
                ["feed", "피드 4:5"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormat(key)}
                  aria-pressed={format === key}
                  className={`min-h-10 rounded-xl px-2 text-[11px] font-black transition ${format === key ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button
                type="button"
                onClick={downloadPoster}
                disabled={busyAction !== null}
                className="min-h-12 rounded-2xl bg-slate-950 px-4 text-sm font-black text-lime-200 shadow-lg shadow-slate-950/15 disabled:opacity-50"
              >
                {busyAction === "download" ? "이미지 만드는 중…" : "사진으로 저장"}
              </button>
              <button
                type="button"
                onClick={sharePoster}
                disabled={busyAction !== null}
                className="min-h-12 rounded-2xl bg-lime-300 px-4 text-sm font-black text-slate-950 shadow-lg shadow-lime-300/20 disabled:opacity-50"
              >
                {busyAction === "share" ? "공유 준비 중…" : "공유하기"}
              </button>
            </div>
            {notice && <p role="status" className="mt-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-[10px] font-bold leading-5 text-slate-600">{notice}</p>}
            <p className="mt-3 text-[9px] font-bold leading-4 text-slate-400">공유하기는 기기의 공유 메뉴를 열어요. Instagram이 설치된 모바일에서는 공유 대상에서 선택할 수 있습니다.</p>
          </section>

          <section className="mt-3 rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 sm:p-5">
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
