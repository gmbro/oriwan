import { connection } from "next/server";
import Link from "next/link";
import { DashboardSiteHeader } from "@/components/dashboard-site-header";
import { IconArrowRight } from "@/components/icons";
import { MemberPictogram } from "@/components/member-pictogram";
import { SeasonMonthlyBars, SeasonWeeklyBars } from "@/components/season-report-visuals";
import { formatSeasonDuration } from "@/lib/season-report";
import { getSeasonReport } from "@/lib/season-report-server";

export const metadata = {
  title: "100일 시즌 리포트 | 스내사 러닝보드",
  description: "스내사 크루의 100일 러닝 여정과 개인 시즌 포스터",
};

export default async function SeasonReportPage() {
  await connection();
  const report = await getSeasonReport();
  const { crew, members } = report;

  return (
    <main className="min-h-screen bg-oriwan-bg">
      <DashboardSiteHeader active="report" />
      <section className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-7">
        <section className="relative overflow-hidden rounded-[30px] bg-[#101522] px-5 py-7 text-white shadow-2xl shadow-slate-950/15 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-lime-300/15 blur-3xl" />
          <div className="relative">
            <p className="inline-flex rounded-full bg-lime-300 px-3 py-1 text-[10px] font-black text-slate-950">100 DAYS · SEASON COMPLETE</p>
            <h2 className="font-rounded-title mt-4 text-[clamp(2.5rem,12vw,5.4rem)] leading-[0.95] text-white">스내사 크루의<br /><span className="text-lime-200">100일</span></h2>
            <p className="mt-4 max-w-xl text-sm font-bold leading-6 text-white/60">2026.05.05–08.12 · 함께 만든 아침의 기록을 한 장씩 펼쳐보세요.</p>
          </div>
          <div className="relative mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["함께한 크루", `${crew.participantCount}명`],
              ["전체 인증", `${crew.totalCertifiedDays.toLocaleString("ko-KR")}회`],
              ["누적 거리", `${crew.totalDistanceKm.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}km`],
              ["누적 시간", formatSeasonDuration(crew.totalDurationSeconds)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/8 px-3 py-3 ring-1 ring-white/10 backdrop-blur-sm">
                <p className="text-[9px] font-black text-white/45">{label}</p>
                <p className="mt-1 break-keep text-lg font-black leading-tight text-white sm:text-xl">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 sm:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-950">주간 인증 흐름</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">100일 동안 크루가 함께 채운 인증률</p>
              </div>
              <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-lime-200">최고 {crew.bestWeekLabel}</span>
            </div>
            <div className="mt-4 text-slate-950"><SeasonWeeklyBars weeks={crew.weeks} accent="#84cc16" /></div>
          </article>
          <article className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 sm:p-6">
            <p className="text-sm font-black text-slate-950">월간 인증률</p>
            <p className="mt-1 text-[11px] font-bold text-slate-500">5월부터 8월까지 이어온 흐름</p>
            <div className="mt-6 text-slate-950"><SeasonMonthlyBars months={crew.months} accent="#84cc16" /></div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              {[
                ["전체 인증률", `${crew.certificationRate}%`],
                ["리커버리", `${crew.recoveryRecordCount}회`],
                ["획득 뱃지", `${crew.badgeCount}개`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 px-2 py-3">
                  <p className="text-[9px] font-black text-slate-400">{label}</p>
                  <p className="mt-1 text-base font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-lg font-black text-slate-950">개인 포스터 선택</p>
              <p className="mt-1 text-xs font-bold text-slate-500">캐릭터를 누르면 각자의 100일 포스터가 열려요.</p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-950/5">{members.length}명</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {members.map((member) => (
              <Link
                key={member.id}
                href={`/dashboard/report/${member.id}`}
                className="group relative overflow-hidden rounded-[24px] p-3 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl sm:p-4"
                style={{ background: `linear-gradient(145deg, ${member.theme.background}, ${member.theme.surface})` }}
              >
                <div className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full opacity-20 blur-xl" style={{ backgroundColor: member.theme.accent }} />
                <div className="relative flex items-start justify-between gap-2">
                  <MemberPictogram index={member.pictogramIndex} participantName={member.name} className="!h-14 !w-14 sm:!h-16 sm:!w-16" />
                  <IconArrowRight size={16} className="mt-1 text-white/35 transition group-hover:translate-x-1 group-hover:text-white" />
                </div>
                <p className="relative mt-3 truncate text-base font-black">{member.name}</p>
                <p className="relative mt-1 truncate text-[10px] font-black" style={{ color: member.theme.accent }}>{member.theme.label}</p>
                <div className="relative mt-3 flex items-center justify-between gap-1 text-[9px] font-bold text-white/55">
                  <span>{member.certifiedDays}/100일</span>
                  <span>{member.distanceKm.toFixed(1)}km</span>
                </div>
                {member.hasHundredDayBadge && (
                  <span className="absolute bottom-3 right-3 rounded-full border border-sky-300/50 bg-sky-300/15 px-2 py-1 text-[8px] font-black text-sky-100">👑 100일</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
