import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GoogleLoginButton from "./GoogleLoginButton";

export default async function Home() {
  // 이미 로그인한 유저는 대시보드로 바로 이동
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10">
      {/* 배경 장식 */}
      <div className="fixed top-[-20%] right-[-15%] w-[400px] h-[400px] rounded-full bg-oriwan-accent/8 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[350px] h-[350px] rounded-full bg-oriwan-primary/6 blur-[100px] pointer-events-none" />

      {/* 로그인 카드 */}
      <div className="relative w-full max-w-[400px] mx-auto">
        <div className="card p-8 sm:p-10 text-center">
          {/* 오리 로고 이미지 */}
          <div className="animate-fade-up mb-5">
            <div className="w-24 h-24 mx-auto relative">
              <Image
                src="/oriwan-logo.png"
                alt="오리완 로고"
                width={96}
                height={96}
                className="object-contain drop-shadow-lg"
                priority
              />
            </div>
          </div>

          {/* 서비스명 */}
          <h1 className="animate-fade-up text-3xl font-black tracking-tight mb-1.5" style={{ animationDelay: "0.05s" }}>
            오리완
          </h1>
          <p className="animate-fade-up text-[13px] text-oriwan-primary font-semibold tracking-wide mb-8" style={{ animationDelay: "0.08s" }}>
            오늘의 리커버리 완료
          </p>

          {/* 구글 로그인 버튼 */}
          <div className="animate-fade-up" style={{ animationDelay: "0.12s" }}>
            <GoogleLoginButton />
          </div>

          {/* 구분선 */}
          <div className="animate-fade-up my-6 flex items-center gap-3" style={{ animationDelay: "0.18s" }}>
            <div className="flex-1 h-px bg-oriwan-border" />
            <span className="text-[11px] text-oriwan-text-muted tracking-wider">이런 걸 할 수 있어요</span>
            <div className="flex-1 h-px bg-oriwan-border" />
          </div>

          {/* 기능 태그 */}
          <div className="animate-fade-up flex items-center justify-center gap-2 flex-wrap" style={{ animationDelay: "0.22s" }}>
            <span className="inline-flex items-center gap-1 text-[12px] text-oriwan-text-muted px-3 py-1.5 rounded-full bg-oriwan-surface-light">
              🏃 러닝 인증
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] text-oriwan-text-muted px-3 py-1.5 rounded-full bg-oriwan-surface-light">
              🧬 AI 회복 팁
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] text-oriwan-text-muted px-3 py-1.5 rounded-full bg-oriwan-surface-light">
              🌱 잔디 기록
            </span>
          </div>
        </div>

        {/* 하단 안내 */}
        <p className="animate-fade-up text-center text-[11px] text-oriwan-text-muted/60 mt-4" style={{ animationDelay: "0.26s" }}>
          Google 계정으로 간편하게 시작할 수 있어요
        </p>
      </div>
    </main>
  );
}
