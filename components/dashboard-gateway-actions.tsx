"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useFourthViewer } from "@/components/fourth-viewer-provider";
import { KakaoLoginButton } from "@/components/kakao-login-button";

const authErrorNotices = {
  auth_failed: {
    title: "로그인을 완료하지 못했어요",
    description: "연결 정보를 새로 준비했어요. 아래 버튼으로 다시 로그인해 주세요.",
  },
  auth_cancelled: {
    title: "카카오 로그인이 취소됐어요",
    description: "원할 때 다시 로그인할 수 있어요.",
  },
  auth_expired: {
    title: "로그인 시간이 만료됐어요",
    description: "새 로그인 요청으로 안전하게 다시 연결해 주세요.",
  },
  auth_provider_failed: {
    title: "로그인 서버 연결을 마치지 못했어요",
    description: "잠시 후 새 로그인 요청으로 다시 연결해 주세요.",
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
        닫기
      </Link>
    </section>
  );
}

export function DashboardGatewayActions() {
  const router = useRouter();
  const { viewer, loading, error } = useFourthViewer();

  useEffect(() => {
    if (!loading && viewer?.authenticated) {
      router.replace("/4th/dashboard#member-features");
    }
  }, [loading, router, viewer?.authenticated]);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-5 text-sm font-black text-[#191919]" role="status" aria-live="polite">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#191919]/55" aria-hidden="true" />
          로그인 상태 확인 중
        </div>
      ) : viewer?.authenticated ? (
        <Link
          href="/4th/dashboard#member-features"
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 text-center text-sm font-black text-white shadow-lg shadow-blue-500/15 transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
          aria-live="polite"
        >
          대시보드로 이동 중
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <KakaoLoginButton
            nextPath="/4th/dashboard#member-features"
            label="카카오로 시작하기"
            restart
            className="min-h-14 px-2 text-xs leading-tight"
          />
          <Link href="/4th/dashboard" className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-2 text-center text-xs font-black leading-tight text-white shadow-lg shadow-blue-500/15 transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
            로그인 없이 대시보드 보기
          </Link>
        </div>
      )}
      {error ? <p className="px-2 text-center text-xs font-bold text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
