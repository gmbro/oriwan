"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { KakaoLoginButton } from "@/components/kakao-login-button";
import { TwttBrandMark } from "@/components/twtt-brand-mark";
import riversideImage from "@/public/images/poc/hello-2027/hello-2027-riverside.webp";

const DailyFortune = dynamic(() => import("@/components/daily-fortune").then((module) => module.DailyFortune), {
  loading: () => <div className="h-48 animate-pulse rounded-[26px] bg-slate-100" aria-label="오늘의 운세를 불러오는 중" />,
});
const DailyGiftBox = dynamic(() => import("@/components/daily-gift-box").then((module) => module.DailyGiftBox), {
  loading: () => <div className="h-48 animate-pulse rounded-[26px] bg-slate-100" aria-label="응원 상자를 불러오는 중" />,
});
const PersonalRecordsDashboard = dynamic(
  () => import("@/components/personal-records-dashboard").then((module) => module.PersonalRecordsDashboard),
  { loading: () => <div className="mt-4 h-64 animate-pulse rounded-[28px] bg-slate-100" aria-label="개인 러닝 기록을 불러오는 중" /> },
);

type MeData = {
  user: { id: string };
  display_name: string | null;
  name_source?: "admin" | "kakao" | null;
  matched_participant: { id: string; name: string } | null;
  connection_status: "approved" | "pending" | "revoked" | "unlinked" | "invalid" | "setup_required" | "admin_missing";
  connection_message: string;
};

function PageShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className={`flex min-h-screen min-h-svh justify-center overflow-x-hidden bg-[linear-gradient(180deg,#eef4ff_0%,#f7f8fa_34%,#f7f8fa_100%)] px-3 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] sm:px-5 sm:py-10 ${wide ? "items-start" : "items-center"}`}>
      <div className={`w-full ${wide ? "max-w-[1120px]" : "max-w-[900px]"}`}>{children}</div>
    </main>
  );
}

export default function MyPage() {
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) {
        setData(null);
        setMessage(json.error || "카카오 로그인이 필요해요.");
        return;
      }
      setData(json);
      setMessage("");
    } catch {
      setData(null);
      setMessage("개인 기능을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadMe());
  }, [loadMe]);

  const logout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("logout_failed");
      setData(null);
      setMessage("로그아웃됐어요.");
    } catch {
      setMessage("로그아웃하지 못했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-[520px] rounded-[28px] bg-white p-6 shadow-[0_18px_52px_rgba(27,45,74,0.1)] sm:p-8" aria-label="개인 기능을 불러오는 중" aria-busy="true">
          <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-5 h-32 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell>
        <div className="mx-auto grid w-full overflow-hidden rounded-[30px] bg-white shadow-[0_24px_70px_rgba(27,45,74,0.14)] ring-1 ring-slate-950/5 md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-[220px] overflow-hidden md:min-h-[520px]">
            <Image src={riversideImage} alt="한강을 달리는 러너들의 풍경" fill preload placeholder="blur" sizes="(max-width: 767px) 100vw, 420px" className="object-cover object-[58%_center] brightness-[0.72] saturate-[0.9]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,18,35,0.25),rgba(7,18,35,0.65))]" aria-hidden="true" />
            <div className="absolute left-5 top-5 flex w-[86px] items-center rounded-2xl bg-white/95 px-3 py-2.5 shadow-xl md:left-7 md:top-7 md:w-[100px]">
              <TwttBrandMark className="aspect-[640/310] w-full" sizes="100px" />
            </div>
            <p className="absolute bottom-6 left-5 right-5 text-lg font-black leading-7 text-white md:bottom-8 md:left-7 md:right-7 md:text-2xl md:leading-8">
              오늘의 마음과 달리기를<br />한곳에 모아보세요.
            </p>
          </div>
          <div className="flex flex-col justify-center p-5 sm:p-8 md:p-10">
            <p className="text-xs font-black text-blue-600">PERSONAL · TWTT 4TH</p>
            <h1 className="mt-2 text-[1.75rem] font-black leading-tight tracking-[-0.035em] text-slate-950 sm:text-3xl">나만의 100일<br />러닝 화면</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              카카오로 로그인하면 오늘의 운세를 보고, 인증 후 응원 상자와 개인 러닝 리포트를 확인할 수 있어요.
            </p>
            {message ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold leading-5 text-rose-700" role="status">{message}</p> : null}
            <div className="mt-6"><KakaoLoginButton nextPath="/me" label="카카오로 로그인" className="min-h-14 rounded-[18px]" /></div>
            <Link href="/4th/dashboard" className="mt-2 flex min-h-11 items-center justify-center rounded-2xl text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-blue-700">로그인 없이 4기 대시보드 보기</Link>
            <div className="mt-5 flex justify-center gap-4 text-[11px] font-bold text-slate-400">
              <Link href="/terms" className="min-h-9 inline-flex items-center underline underline-offset-2">이용약관</Link>
              <Link href="/privacy" className="min-h-9 inline-flex items-center underline underline-offset-2">개인정보처리방침</Link>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  const name = data.display_name || data.matched_participant?.name || "이름 확인 중";

  return (
    <PageShell wide>
      <section className="overflow-hidden rounded-[28px] bg-white p-4 shadow-[0_14px_44px_rgba(27,45,74,0.08)] ring-1 ring-slate-950/5 sm:rounded-[32px] sm:p-7" aria-labelledby="personal-page-title">
        <div className="flex items-center justify-between gap-3">
          <Link href="/4th/dashboard" aria-label="4기 대시보드로 이동" className="inline-flex min-h-11 items-center">
            <TwttBrandMark className="aspect-[640/310] w-[88px] sm:w-[104px]" sizes="(max-width: 640px) 88px, 104px" />
          </Link>
          <button type="button" onClick={logout} className="min-h-11 rounded-2xl bg-slate-100 px-4 text-xs font-black text-slate-600 transition hover:bg-slate-200">로그아웃</button>
        </div>

        <div className="mt-5 sm:mt-7">
          <p className="text-xs font-black text-blue-600">PERSONAL · TWTT 4TH</p>
          <h1 id="personal-page-title" className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950 sm:text-3xl">{name}님, 오늘도 반가워요</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-oriwan-text-muted">
            카카오 계정으로 바로 연결된 4기 개인 화면이에요. 오늘의 운세와 응원 상자, 개인 러닝 기록을 한곳에서 확인할 수 있어요.
          </p>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2 lg:gap-4">
          <DailyFortune />
          <div className="[&>section]:mt-0"><DailyGiftBox /></div>
        </div>

        <nav className="mt-5 grid grid-cols-2 gap-2" aria-label="개인 화면 바로가기">
          <Link href="/4th/dashboard#guestbook" className="flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-3 text-sm font-black text-white">댓글로 이동</Link>
          <Link href="/4th/dashboard" className="flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 px-3 text-sm font-black text-slate-700">4기 대시보드</Link>
        </nav>
      </section>
      <PersonalRecordsDashboard />
    </PageShell>
  );
}
