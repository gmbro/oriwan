import Image from "next/image";
import Link from "next/link";

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
            러닝 인증 현황을 한눈에 보는 실시간 보드
          </p>

          <div className="animate-fade-up space-y-3" style={{ animationDelay: "0.12s" }}>
            <Link href="/dashboard" className="btn-primary w-full">
              참가자 대시보드 보기
            </Link>
            <Link href="/admin" className="btn-google w-full">
              관리자 페이지
            </Link>
          </div>
        </div>

        {/* 하단 약관 */}
        <div className="animate-fade-up text-center mt-5 space-y-2" style={{ animationDelay: "0.26s" }}>
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
