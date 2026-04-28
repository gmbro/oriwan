import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  // 이미 로그인한 유저는 대시보드로 바로 이동
  const cookieStore = await cookies();
  const session = cookieStore.get("oriwan_session");
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-oriwan-bg">
      {/* 배경 그래디언트 오브 (모바일에서도 은은하게) */}
      <div className="fixed top-[-30%] right-[-20%] w-[400px] h-[400px] rounded-full bg-oriwan-primary/6 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-15%] w-[350px] h-[350px] rounded-full bg-oriwan-accent/5 blur-[100px] pointer-events-none" />

      {/* 로그인 카드 */}
      <div className="relative w-full max-w-[380px] mx-auto">
        <div className="glass-card p-8 sm:p-10 text-center">
          {/* 로고 아이콘 */}
          <div className="animate-fade-up mb-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-oriwan-primary to-oriwan-accent flex items-center justify-center shadow-lg shadow-oriwan-primary/20">
              <span className="text-4xl">🏃</span>
            </div>
          </div>

          {/* 서비스명 */}
          <h1 className="animate-fade-up text-3xl font-black tracking-tight mb-2" style={{ animationDelay: "0.05s" }}>
            오리완
          </h1>

          {/* 설명 */}
          <p className="animate-fade-up text-sm text-oriwan-text-muted leading-relaxed mb-8" style={{ animationDelay: "0.1s" }}>
            Strava 러닝 데이터를 연동하고
            <br />
            AI 맞춤 회복 팁을 받아보세요
          </p>

          {/* Strava 로그인 버튼 */}
          <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <Link
              href="/api/auth/strava"
              className="flex items-center justify-center gap-3 w-full py-3.5 px-6 rounded-xl bg-[#FC4C02] hover:bg-[#E34402] text-white font-semibold text-[15px] transition-all duration-200 hover:shadow-lg hover:shadow-[#FC4C02]/30 active:scale-[0.98]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              Strava로 계속하기
            </Link>
          </div>

          {/* 구분선 */}
          <div className="animate-fade-up my-6 flex items-center gap-3" style={{ animationDelay: "0.2s" }}>
            <div className="flex-1 h-px bg-oriwan-border" />
            <span className="text-[11px] text-oriwan-text-muted tracking-wider">서비스 소개</span>
            <div className="flex-1 h-px bg-oriwan-border" />
          </div>

          {/* 기능 태그 */}
          <div className="animate-fade-up flex items-center justify-center gap-2 flex-wrap" style={{ animationDelay: "0.25s" }}>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-oriwan-text-muted px-3 py-1.5 rounded-full bg-oriwan-surface-light">
              🏃 러닝 인증
            </span>
            <span className="text-oriwan-border text-[10px]">·</span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-oriwan-text-muted px-3 py-1.5 rounded-full bg-oriwan-surface-light">
              🧬 AI 회복 팁
            </span>
            <span className="text-oriwan-border text-[10px]">·</span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-oriwan-text-muted px-3 py-1.5 rounded-full bg-oriwan-surface-light">
              🌱 잔디 기록
            </span>
          </div>
        </div>

        {/* 하단 안내 */}
        <p className="animate-fade-up text-center text-[11px] text-oriwan-text-muted/60 mt-5" style={{ animationDelay: "0.3s" }}>
          Strava 계정으로 러닝 데이터를 연동합니다
        </p>
      </div>
    </main>
  );
}
