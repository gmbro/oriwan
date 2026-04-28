import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GoogleLoginButton from "./GoogleLoginButton";
import { IconRun, IconDna, IconSprout } from "@/components/icons";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="fixed top-[-20%] right-[-15%] w-[400px] h-[400px] rounded-full bg-oriwan-accent/8 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[350px] h-[350px] rounded-full bg-oriwan-primary/6 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-[400px] mx-auto">
        <div className="card p-8 sm:p-10 text-center">
          {/* 오리 로고 */}
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

          <h1 className="animate-fade-up text-3xl font-black tracking-tight mb-1.5" style={{ animationDelay: "0.05s" }}>
            오리완
          </h1>
          <p className="animate-fade-up text-[13px] text-oriwan-primary font-semibold tracking-wide mb-8" style={{ animationDelay: "0.08s" }}>
            오늘의 리커버리 완료
          </p>

          {/* 구글 로그인 */}
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
            <span className="inline-flex items-center gap-1.5 text-[12px] text-oriwan-text-muted px-3 py-1.5 rounded-full bg-oriwan-surface-light">
              <IconRun size={14} className="text-oriwan-primary" />
              러닝 인증
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-oriwan-text-muted px-3 py-1.5 rounded-full bg-oriwan-surface-light">
              <IconDna size={14} className="text-oriwan-primary" />
              AI 회복 팁
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-oriwan-text-muted px-3 py-1.5 rounded-full bg-oriwan-surface-light">
              <IconSprout size={14} className="text-oriwan-primary" />
              잔디 기록
            </span>
          </div>
        </div>

        {/* 하단 안내 + 약관 */}
        <div className="animate-fade-up text-center mt-5 space-y-2" style={{ animationDelay: "0.26s" }}>
          <p className="text-[11px] text-oriwan-text-muted/60">
            Google 계정으로 간편하게 시작할 수 있어요
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
