"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFourthViewer } from "@/components/fourth-viewer-provider";
import { KakaoLoginButton } from "@/components/kakao-login-button";

const authErrorNotices = {
  auth_failed: {
    title: "로그인을 완료하지 못했어요",
    description: "카카오 로그인 화면을 닫았거나 연결 중 문제가 생겼어요. 다시 시도해 주세요.",
  },
  auth_unavailable: {
    title: "카카오 로그인을 준비 중이에요",
    description: "잠시 후 다시 시도하거나 로그인 없이 대시보드를 둘러보세요.",
  },
  auth_in_progress: {
    title: "로그인 연결 중이에요",
    description: "열려 있는 카카오 로그인 화면을 먼저 완료하거나 잠시 후 다시 시도해 주세요.",
  },
} as const;

export function DashboardGatewayAuthNotice() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const notice = errorCode && errorCode in authErrorNotices
    ? authErrorNotices[errorCode as keyof typeof authErrorNotices]
    : null;

  if (!notice) return null;

  return (
    <section
      className="mb-4 flex items-start gap-3 rounded-2xl bg-rose-50 px-4 py-3.5 text-left ring-1 ring-inset ring-rose-100"
      role="alert"
      aria-labelledby="gateway-auth-error-title"
      aria-describedby="gateway-auth-error-description"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-black text-rose-600" aria-hidden="true">
        !
      </span>
      <span className="min-w-0 flex-1">
        <strong id="gateway-auth-error-title" className="block text-sm font-black text-slate-900">
          {notice.title}
        </strong>
        <span id="gateway-auth-error-description" className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
          {notice.description}
        </span>
      </span>
      <Link
        href="/4th"
        replace
        scroll={false}
        className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-xl px-2 text-xs font-black text-rose-600 transition hover:bg-rose-100 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
        aria-label="로그인 오류 안내 닫기"
      >
        확인
      </Link>
    </section>
  );
}

export function DashboardGatewayActions() {
  const { viewer, loading, actionPending, error, logout } = useFourthViewer();

  return (
    <div className="space-y-2.5">
      {loading ? (
        <div className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-[#FEE500] px-5 text-sm font-black text-[#191919]" role="status" aria-live="polite">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#191919]/55" aria-hidden="true" />
          로그인 상태 확인 중
        </div>
      ) : viewer?.authenticated ? (
        <>
          <p className="mb-3 rounded-2xl bg-blue-50 px-4 py-3 text-center text-xs font-bold leading-5 text-blue-700">
            {viewer.display_name ? `${viewer.display_name}님으로 로그인되어 있어요.` : "카카오로 로그인되어 있어요."}
          </p>
          <Link href="/4th/dashboard#member-features" className="flex min-h-14 w-full items-center justify-center rounded-[18px] bg-blue-600 px-5 text-center text-sm font-black text-white shadow-[0_10px_24px_rgba(37,99,235,0.2)] transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
            4기 대시보드 들어가기
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={actionPending}
            className="flex min-h-11 w-full items-center justify-center rounded-2xl px-4 text-center text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            {actionPending ? "로그아웃 중" : "로그아웃하고 익명으로 보기"}
          </button>
        </>
      ) : (
        <div className="space-y-1.5">
          <KakaoLoginButton
            nextPath="/4th/dashboard#member-features"
            label="카카오로 시작하기"
            className="min-h-14 rounded-[18px] px-5 text-sm"
          />
          <Link href="/4th/dashboard" className="flex min-h-11 w-full items-center justify-center rounded-2xl px-4 text-center text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
            로그인 없이 대시보드 보기
          </Link>
        </div>
      )}
      {error ? <p className="px-2 text-center text-xs font-bold text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
