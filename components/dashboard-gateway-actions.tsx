"use client";

import Link from "next/link";
import { useFourthViewer } from "@/components/fourth-viewer-provider";
import { KakaoLoginButton } from "@/components/kakao-login-button";

export function DashboardGatewayActions() {
  const { viewer, loading, actionPending, error, logout } = useFourthViewer();

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-5 text-sm font-black text-[#191919]" role="status" aria-live="polite">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#191919]/55" aria-hidden="true" />
          로그인 상태 확인 중
        </div>
      ) : viewer?.authenticated ? (
        <>
          <Link href="/4th" className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-500/15 transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
            4기 대시보드 들어가기
          </Link>
          <p className="px-2 text-center text-[11px] font-bold text-slate-500">
            {viewer.display_name ? `${viewer.display_name}님으로 로그인되어 있어요.` : "카카오로 로그인되어 있어요."}
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={actionPending}
            className="flex min-h-11 w-full items-center justify-center rounded-2xl bg-oriwan-surface-light px-4 text-sm font-black text-oriwan-text-muted ring-1 ring-slate-950/5 transition hover:text-oriwan-text disabled:cursor-wait disabled:opacity-60"
          >
            {actionPending ? "로그아웃 중" : "로그아웃하고 익명으로 보기"}
          </button>
        </>
      ) : (
        <>
          <KakaoLoginButton nextPath="/4th" label="카카오로 시작하기" />
          <Link href="/4th" className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-500/15 transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
            로그인 없이 대시보드 보기
          </Link>
        </>
      )}

      {error ? <p className="px-2 text-center text-xs font-bold text-red-600" role="alert">{error}</p> : null}
      <Link href="/3th" className="flex min-h-11 w-full items-center justify-center rounded-2xl bg-oriwan-surface-light px-4 text-sm font-black text-oriwan-text-muted ring-1 ring-slate-950/5 transition hover:text-oriwan-text">
        지난 3기 기록 보기
      </Link>
    </div>
  );
}
