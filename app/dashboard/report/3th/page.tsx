import Link from "next/link";

import { IconArrowRight } from "@/components/icons";
import { MemberPictogram } from "@/components/member-pictogram";
import { SeasonMonthlyBars, SeasonWeeklyLineChart } from "@/components/season-report-visuals";
import { formatSeasonDuration } from "@/lib/season-report";
import { thirdSeasonReport } from "@/lib/third-season-snapshot";

const THIRD_SEASON_REPORT_PATH = "/dashboard/report/3th";

export const metadata = {
  title: "TWTT 3기 100일 기록 | TWTT 러닝보드",
  description: "2026년 5월 5일부터 8월 12일까지 함께 달린 TWTT 3기 크루의 기록",
};

export default function ThirdSeasonReportPage() {
  const { crew, members } = thirdSeasonReport;

  return (
    <main className="bg-oriwan-bg">
      <section className="mx-auto w-full max-w-7xl px-2.5 py-3 sm:px-4 sm:py-6">
        <section className="relative overflow-hidden rounded-[26px] bg-[#101522] px-4 py-5 text-white shadow-2xl shadow-slate-950/15 sm:rounded-[30px] sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-lime-300/15 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex rounded-full bg-lime-300 px-3 py-1 text-xs font-black text-slate-950">TWTT 3RD · SEASON ARCHIVE</p>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70 ring-1 ring-white/10">지난 시즌 기록</span>
            </div>
            <h1 className="font-rounded-title mt-3 text-[clamp(2.35rem,10vw,4.8rem)] leading-[0.95] text-white">3기 크루의 <span className="text-lime-200">100일</span></h1>
            <p className="mt-3 max-w-xl text-xs font-bold leading-5 text-white/60 sm:text-sm">2026.05.05–08.12 · 함께 만든 아침의 기록을 한 장씩 펼쳐보세요.</p>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4">
            {[
              ["함께한 크루", `${crew.participantCount}명`],
              ["전체 인증", `${crew.totalCertifiedDays.toLocaleString("ko-KR")}회`],
              ["총 거리", `${crew.totalDistanceKm.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}km`],
              ["누적 시간", formatSeasonDuration(crew.totalDurationSeconds)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/8 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm sm:py-3">
                  <p className="text-xs font-black text-white/55">{label}</p>
                <p className="mt-1 break-keep text-lg font-black leading-tight text-white sm:text-xl">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <article className="min-w-0 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-950">주간 인증 흐름</p>
                <p className="mt-1 text-xs font-bold text-slate-500">100일 동안 크루가 함께 채운 인증률</p>
              </div>
              <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-lime-200">최고 {crew.bestWeekLabel}</span>
            </div>
            <div className="mt-3 min-w-0 text-slate-950"><SeasonWeeklyLineChart weeks={crew.weeks} accent="#84cc16" /></div>
          </article>

          <article className="min-w-0 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 sm:p-5">
            <p className="text-sm font-black text-slate-950">월간 인증률</p>
            <p className="mt-1 text-xs font-bold text-slate-500">5월부터 8월까지 이어온 흐름</p>
            <div className="mt-6 text-slate-950"><SeasonMonthlyBars months={crew.months} accent="#84cc16" /></div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              {[
                ["전체 인증률", `${crew.certificationRate}%`],
                ["리커버리", `${crew.recoveryRecordCount}회`],
                ["획득 뱃지", `${crew.badgeCount}개`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 px-2 py-3">
                  <p className="text-xs font-black text-slate-500">{label}</p>
                  <p className="mt-1 text-base font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-lg font-black text-slate-950">3기 개인 기록</p>
              <p className="mt-1 text-xs font-bold text-slate-500">캐릭터를 누르면 각자의 100일 포스터가 열려요.</p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-950/5">{members.length}명</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {members.map((member) => (
              <Link
                key={member.id}
                href={`${THIRD_SEASON_REPORT_PATH}/${member.id}`}
                prefetch={false}
                className="group relative flex min-w-0 flex-col overflow-hidden rounded-[22px] p-3 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                style={{ background: `linear-gradient(145deg, ${member.theme.background}, ${member.theme.surface})` }}
              >
                <div className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full opacity-20 blur-xl" style={{ backgroundColor: member.theme.accent }} />
                <div className="relative flex items-start justify-between gap-2">
                  <MemberPictogram index={member.pictogramIndex} participantName={member.name} className="!h-12 !w-12 sm:!h-14 sm:!w-14" />
                  <div className="flex min-w-0 flex-col items-end gap-1.5">
                    <IconArrowRight size={15} className="text-white/35 transition group-hover:translate-x-1 group-hover:text-white" />
                    {member.hasHundredDayBadge ? (
                      <span className="inline-flex max-w-full items-center rounded-full border border-sky-300/40 bg-sky-300/15 px-2 py-1 text-[10px] font-black text-sky-100">👑 100일</span>
                    ) : null}
                  </div>
                </div>
                <p className="relative mt-2.5 truncate text-[15px] font-black">{member.name}</p>
                <div className="relative mt-2.5 grid grid-cols-2 gap-1.5 text-white max-[359px]:grid-cols-1 max-[359px]:gap-1">
                  <div className="min-w-0 rounded-xl bg-white/8 px-2 py-2">
                    <p className="text-[11px] font-black text-white/50">인증</p>
                    <p className="mt-0.5 truncate text-xs font-black">{member.certifiedDays}/100일</p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-white/8 px-2 py-2">
                    <p className="text-[11px] font-black text-white/50">총 거리</p>
                    <p className="mt-0.5 truncate text-xs font-black">{member.distanceKm.toFixed(1)}km</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
