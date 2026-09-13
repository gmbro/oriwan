"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KakaoLoginButton } from "@/components/kakao-login-button";

export function DashboardGatewayActions() {
  const router = useRouter();
  const warmDashboard = () => router.prefetch("/4th/dashboard");

  return (
    <div className="mx-auto grid w-full max-w-[360px] grid-cols-1 gap-3">
      <Link
        href="/4th/dashboard"
        prefetch={false}
        onPointerEnter={warmDashboard}
        onPointerDown={warmDashboard}
        onFocus={warmDashboard}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 text-center text-sm font-black leading-tight text-white shadow-lg shadow-blue-500/15 transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
      >
        로그인 없이 대시보드 보기
      </Link>
      <KakaoLoginButton
        nextPath="/4th/dashboard#my-activity"
        label="카카오로 시작하기"
        restart
        className="h-14 px-4 text-sm leading-tight"
      />
    </div>
  );
}
