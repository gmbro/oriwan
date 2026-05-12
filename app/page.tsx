import Image from "next/image";
import Link from "next/link";

export default async function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-x-hidden px-3 py-6 sm:px-5 sm:py-10">
      <div className="fixed top-[-20%] right-[-15%] w-[400px] h-[400px] rounded-full bg-oriwan-accent/8 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[350px] h-[350px] rounded-full bg-oriwan-primary/6 blur-[100px] pointer-events-none" />

      <div className="relative mx-auto w-full max-w-[400px]">
        <div className="card mobile-page-card p-6 text-center sm:p-10">
          {/* 오리 로고 */}
          <div className="animate-fade-up mb-4">
            <div className="w-28 h-28 mx-auto relative rounded-3xl overflow-hidden">
              <Image
                src="/oriwan-logo-v2.png"
                alt="스내사 러닝보드 로고"
                width={112}
                height={112}
                className="object-cover"
                priority
              />
            </div>
          </div>

          <h1 className="animate-fade-up mb-1 text-[clamp(1.75rem,8vw,1.875rem)] font-black tracking-tight" style={{ animationDelay: "0.05s" }}>
            스내사 러닝보드
          </h1>
          <p className="animate-fade-up text-[13px] text-oriwan-primary font-semibold tracking-wide mb-8" style={{ animationDelay: "0.08s" }}>
            오늘의 러닝 에너지를 함께 확인해요
          </p>

          <div className="animate-fade-up space-y-3" style={{ animationDelay: "0.12s" }}>
            <Link href="/dashboard" className="btn-primary w-full">
              오늘 인증 보러가기
            </Link>
          </div>
        </div>

        {/* 하단 약관 */}
        <div className="animate-fade-up text-center mt-5 space-y-2" style={{ animationDelay: "0.26s" }}>
          <Link href="/admin" className="inline-flex text-[9px] font-semibold text-oriwan-text-muted/35 underline underline-offset-2 transition-colors hover:text-oriwan-text-muted/70">
            어드민 접속
          </Link>
          <p className="text-[11px] font-semibold text-oriwan-text-muted/70">
            (주)아키랩 · 관리자 이경민
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
