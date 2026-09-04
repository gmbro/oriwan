"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type KakaoLoginButtonProps = {
  nextPath?: string;
  className?: string;
  label?: string;
};

export function KakaoLoginButton({
  nextPath = "/me",
  className = "",
  label = "카카오로 로그인",
}: KakaoLoginButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    setLoading(true);
    setError("");

    try {
      const safeNextPath = nextPath.startsWith("/") && !nextPath.startsWith("//") && !nextPath.includes("\\")
        ? nextPath
        : "/";
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(safeNextPath)}`;
      const { error: loginError } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo },
      });

      if (loginError) throw loginError;
    } catch {
      setError("카카오 로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={login}
        disabled={loading}
        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-5 py-3 text-sm font-black text-[#191919] transition hover:bg-[#f4dc00] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#191919]/30 disabled:cursor-wait disabled:opacity-60 ${className}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
          <path d="M12 3C6.48 3 2 6.56 2 10.95c0 2.82 1.86 5.3 4.66 6.72l-.94 3.46a.52.52 0 0 0 .77.58l4.1-2.72c.46.05.93.08 1.41.08 5.52 0 10-3.56 10-8.12S17.52 3 12 3Z" />
        </svg>
        {loading ? "카카오로 이동하는 중…" : label}
      </button>
      {error ? <p className="mt-2 text-center text-xs font-bold text-rose-600" role="alert">{error}</p> : null}
    </div>
  );
}
