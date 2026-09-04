import Link from "next/link";
import { KakaoLoginButton } from "@/components/kakao-login-button";
import { TwttBrandMark } from "@/components/twtt-brand-mark";

export default async function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-oriwan-bg px-3 py-6 sm:px-5 sm:py-10">
      <div className="relative mx-auto w-full max-w-[440px]">
        <div className="card mobile-page-card p-6 sm:p-9">
          <div className="animate-fade-up flex justify-center">
            <TwttBrandMark className="aspect-[640/310] w-[clamp(164px,46vw,196px)]" sizes="196px" priority />
          </div>

          <h1 className="sr-only">TWTT 공통 대시보드 입구</h1>
          <p className="animate-fade-up mt-6 text-center text-[13px] font-bold leading-6 text-oriwan-text-muted" style={{ animationDelay: "0.05s" }}>
            로그인 없이 함께 달린 기록을 볼 수 있고,<br />카카오로 로그인하면 확인된 이름으로 댓글을 남기고<br />인증 완료 후 응원 상자를 받을 수 있어요.
          </p>

          <div className="animate-fade-up mt-7 space-y-3" style={{ animationDelay: "0.1s" }}>
            <Link href="/4th" className="btn-primary flex min-h-12 w-full items-center justify-center">
              TWTT 4기 대시보드
            </Link>
            <KakaoLoginButton nextPath="/4th" />
            <Link href="/3th" className="flex min-h-11 w-full items-center justify-center rounded-2xl bg-oriwan-surface-light px-4 text-sm font-black text-oriwan-text-muted ring-1 ring-slate-950/5 transition hover:text-oriwan-text">
              TWTT 3기 대시보드
            </Link>
          </div>

          <p className="mt-5 rounded-2xl bg-blue-50 px-4 py-3 text-[11px] font-bold leading-5 text-blue-700">
            카카오 로그인 여부와 관계없이 대시보드는 공개됩니다. 로그인하지 않은 댓글은 익명 닉네임으로 표시돼요.
          </p>
        </div>

        {/* 하단 약관 */}
        <div className="animate-fade-up text-center mt-5 space-y-2" style={{ animationDelay: "0.26s" }}>
          <Link href="/admin" className="inline-flex text-[9px] font-semibold text-oriwan-text-muted/35 underline underline-offset-2 transition-colors hover:text-oriwan-text-muted/70">
            어드민 접속
          </Link>
          <p className="text-[11px] font-semibold text-oriwan-text-muted/70">
            TWTT · 운영 (주)아키랩
          </p>
          <div className="flex items-center justify-center gap-3 text-[11px] text-oriwan-text-muted/50">
            <Link href="/terms" className="hover:text-oriwan-text-muted transition-colors underline underline-offset-2">
              이용약관
            </Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-oriwan-text-muted transition-colors underline underline-offset-2">
              개인정보처리방침
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
