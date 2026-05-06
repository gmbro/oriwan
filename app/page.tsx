import Image from "next/image";
import Link from "next/link";
import GoogleLoginButton from "./GoogleLoginButton";
import { IconRun, IconDna, IconSprout } from "@/components/icons";

export default async function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="fixed top-[-20%] right-[-15%] w-[400px] h-[400px] rounded-full bg-oriwan-accent/8 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[350px] h-[350px] rounded-full bg-oriwan-primary/6 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-[400px] mx-auto">
        <div className="card p-8 sm:p-10 text-center">
          {/* 오리 로고 */}
          <div className="animate-fade-up mb-4">
            <div className="w-28 h-28 mx-auto relative rounded-3xl overflow-hidden">
              <Image
                src="/oriwan-logo-v2.png"
                alt="스내사 3기 대시보드 로고"
                width={112}
                height={112}
                className="object-cover"
                priority
              />
            </div>
          </div>

          <h1 className="animate-fade-up text-3xl font-black tracking-tight mb-1" style={{ animationDelay: "0.05s" }}>
            스내사 3기
          </h1>
          <p className="animate-fade-up text-[13px] text-oriwan-primary font-semibold tracking-wide mb-8" style={{ animationDelay: "0.08s" }}>
            러닝 인증을 실시간으로 읽는 운영 보드
          </p>

          {/* 구글 로그인 */}
          <div className="animate-fade-up" style={{ animationDelay: "0.12s" }}>
            <GoogleLoginButton />
          </div>

          {/* 구분선 */}
          <div className="animate-fade-up my-6 flex items-center gap-3" style={{ animationDelay: "0.18s" }}>
            <div className="flex-1 h-px bg-oriwan-border" />
            <span className="text-[11px] text-oriwan-text-muted tracking-wider whitespace-nowrap">이런 걸 할 수 있어요</span>
            <div className="flex-1 h-px bg-oriwan-border" />
          </div>

          {/* 기능 태그 — 한 줄 */}
          <div className="animate-fade-up flex items-center justify-center gap-1.5" style={{ animationDelay: "0.22s" }}>
            <span className="inline-flex items-center gap-1 text-[11px] text-oriwan-text-muted px-2.5 py-1.5 rounded-full bg-oriwan-surface-light whitespace-nowrap">
              <IconRun size={12} className="text-oriwan-primary" />
              이미지 인증
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-oriwan-text-muted px-2.5 py-1.5 rounded-full bg-oriwan-surface-light whitespace-nowrap">
              <IconDna size={12} className="text-oriwan-primary" />
              AI 추출
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-oriwan-text-muted px-2.5 py-1.5 rounded-full bg-oriwan-surface-light whitespace-nowrap">
              <IconSprout size={12} className="text-oriwan-primary" />
              그래프 대시보드
            </span>
          </div>
        </div>

        {/* 하단 약관 */}
        <div className="animate-fade-up text-center mt-5 space-y-2" style={{ animationDelay: "0.26s" }}>
          <p className="text-[11px] text-oriwan-text-muted/60">
            Google 계정으로 스내사 3기 대시보드를 시작하세요
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
