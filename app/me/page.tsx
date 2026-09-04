"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DailyGiftBox } from "@/components/daily-gift-box";
import { DailyFortune } from "@/components/daily-fortune";
import { KakaoLoginButton } from "@/components/kakao-login-button";
import { TwttBrandMark } from "@/components/twtt-brand-mark";

type MeData = {
  user: { id: string };
  display_name: string | null;
  name_source?: "admin" | "kakao" | null;
  matched_participant: { id: string; name: string } | null;
  connection_status: "approved" | "pending" | "revoked" | "unlinked" | "invalid" | "setup_required" | "admin_missing";
  connection_message: string;
};

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-oriwan-bg px-3 py-6 sm:px-5 sm:py-10">
      <div className="w-full max-w-[520px]">{children}</div>
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
        <div className="card mobile-page-card p-6 sm:p-8" aria-label="개인 기능을 불러오는 중">
          <div className="mx-auto aspect-[640/310] w-32 animate-pulse rounded-xl bg-slate-100" />
          <div className="mt-6 h-24 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell>
        <div className="card mobile-page-card p-6 text-center sm:p-9">
          <TwttBrandMark className="mx-auto aspect-[640/310] w-[164px] sm:w-[184px]" sizes="(max-width: 640px) 164px, 184px" priority />
          <h1 className="mt-6 text-2xl font-black text-oriwan-text">개인 기능 로그인</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-oriwan-text-muted">
            카카오로 로그인하면 인증 없이 오늘의 운세를 보고, 오늘 인증을 마친 뒤 응원 상자를 열 수 있어요.
          </p>
          {message ? <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-bold text-slate-600">{message}</p> : null}
          <div className="mt-6"><KakaoLoginButton nextPath="/me" /></div>
          <Link href="/4th" className="mt-4 flex min-h-11 items-center justify-center text-xs font-black text-blue-600">4기 대시보드 보기</Link>
        </div>
      </PageShell>
    );
  }

  const name = data.display_name || data.matched_participant?.name || "이름 확인 중";

  return (
    <PageShell>
      <div className="card mobile-page-card overflow-hidden p-5 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <TwttBrandMark className="aspect-[640/310] w-[104px] sm:w-[120px]" sizes="(max-width: 640px) 104px, 120px" priority />
          <button type="button" onClick={logout} className="min-h-11 rounded-2xl bg-slate-100 px-4 text-xs font-black text-slate-600">로그아웃</button>
        </div>

        <div className="mt-6">
          <p className="text-[11px] font-black text-blue-600">PERSONAL</p>
          <h1 className="mt-1 text-2xl font-black text-oriwan-text">{name}님</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-oriwan-text-muted">
            {data.matched_participant
              ? "운영자가 4기 크루와 연결한 계정이며 운영자 확인 이름으로 댓글을 작성해요."
              : `${data.display_name ? `${data.display_name} 카카오 이름을 사용해요. ` : ""}${data.connection_message}`}
          </p>
        </div>

        <div className="mt-5"><DailyFortune /></div>

        {data.matched_participant ? <DailyGiftBox /> : (
          <div className="mt-5 rounded-3xl bg-amber-50 px-5 py-4 text-sm font-bold leading-6 text-amber-900 ring-1 ring-amber-100">
            댓글은 카카오 프로필 이름으로 작성할 수 있어요. 운영자가 4기 크루와 연결하면 응원 상자 기능도 열립니다.
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link href="/4th#guestbook" className="flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-3 text-sm font-black text-white">댓글로 이동</Link>
          <Link href="/4th" className="flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 px-3 text-sm font-black text-slate-700">4기 대시보드</Link>
        </div>
      </div>
    </PageShell>
  );
}
