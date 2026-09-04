"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DailyGiftBox } from "@/components/daily-gift-box";
import { KakaoLoginButton } from "@/components/kakao-login-button";

type Viewer = {
  authenticated: boolean;
  auth_available?: boolean;
  provider: "kakao" | null;
  display_name: string | null;
  approved_participant: boolean;
  verified_name?: boolean;
  connection_status?: string;
};

export function FourthDashboardMemberArea() {
  const [viewer, setViewer] = useState<Viewer | null>(null);

  const loadViewer = useCallback(async () => {
    try {
      const response = await fetch("/api/hello-2027/viewer", { cache: "no-store" });
      const json = await response.json();
      setViewer(response.ok ? json : { authenticated: false, provider: null, display_name: null, approved_participant: false });
    } catch {
      setViewer({ authenticated: false, provider: null, display_name: null, approved_participant: false });
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadViewer());
  }, [loadViewer]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await loadViewer();
  };

  if (!viewer) {
    return (
      <section className="mx-auto mt-3 w-[calc(100%_-_var(--page-gutter)_*_2)] max-w-[1200px] rounded-[20px] bg-white p-3 ring-1 ring-slate-950/5 sm:mt-4 sm:rounded-[24px] sm:p-4" aria-label="개인 기능을 불러오는 중">
        <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  return (
    <section id="member-features" className="mx-auto mt-3 w-[calc(100%_-_var(--page-gutter)_*_2)] max-w-[1200px] rounded-[20px] bg-white p-3 shadow-[0_12px_34px_rgba(25,31,40,0.06)] ring-1 ring-slate-950/5 sm:mt-4 sm:rounded-[24px] sm:p-5" aria-labelledby="member-features-title">
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="hidden text-[11px] font-extrabold text-blue-600 sm:block">PERSONAL</p>
          <h2 id="member-features-title" className="truncate text-sm font-black text-slate-950 sm:mt-1 sm:text-lg">
            {viewer.authenticated ? `${viewer.display_name || "이름 확인 중"}님` : "카카오로 로그인하기"}
          </h2>
          <p className="mt-1 hidden text-xs font-semibold leading-5 text-slate-500 sm:block">
            {viewer.authenticated
              ? viewer.verified_name
                ? "운영자가 확인한 이름으로 댓글을 남기고, 인증 완료 후 응원 상자를 열 수 있어요."
                : "운영자가 이름을 확인하면 확인된 이름 댓글과 응원 상자 기능이 열려요."
              : "로그인하면 운영자 확인 이름으로 댓글을 남기고 오늘의 응원 상자를 받을 수 있어요."}
          </p>
        </div>
        <div className="w-[154px] shrink-0 sm:w-auto sm:min-w-[190px]">
          {viewer.authenticated ? (
            <div className="grid grid-cols-2 gap-2">
              <Link href="#guestbook" className="flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-xs font-black text-white">댓글 쓰기</Link>
              <button type="button" onClick={logout} className="min-h-11 rounded-2xl bg-slate-100 px-4 text-xs font-black text-slate-600">로그아웃</button>
            </div>
          ) : (
            <KakaoLoginButton nextPath="/4th" label="카카오로 시작하기" />
          )}
        </div>
      </div>

      {viewer.authenticated && viewer.approved_participant ? <DailyGiftBox /> : null}
    </section>
  );
}
