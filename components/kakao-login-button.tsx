"use client";

import { useRef, useState } from "react";
import { getSafeAuthReturnPath } from "@/lib/auth-return-path";

type KakaoLoginButtonProps = {
  nextPath?: string;
  className?: string;
  label?: string;
  variant?: "default" | "compact";
};

export function KakaoLoginButton({
  nextPath = "/me",
  className = "",
  label = "카카오로 로그인",
  variant = "default",
}: KakaoLoginButtonProps) {
  const startedRef = useRef(false);
  const [pending, setPending] = useState(false);
  const safeNextPath = getSafeAuthReturnPath(nextPath, "/");
  const compact = variant === "compact";

  return (
    <div className={compact ? "inline-flex shrink-0" : "w-full"}>
      <a
        href={`/api/auth/kakao?next=${encodeURIComponent(safeNextPath)}`}
        aria-disabled={pending}
        aria-busy={pending}
        onClick={(event) => {
          if (startedRef.current) {
            event.preventDefault();
            return;
          }
          startedRef.current = true;
          setPending(true);
        }}
        className={`inline-flex items-center justify-center gap-2 bg-[#FEE500] font-black text-[#191919] transition hover:bg-[#f4dc00] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#191919]/30 ${pending ? "cursor-wait opacity-70" : ""} ${compact
          ? "min-h-11 rounded-full px-3 py-2 text-[11px]"
          : "min-h-12 w-full rounded-2xl px-5 py-3 text-sm"
        } ${className}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className={compact ? "h-4 w-4 fill-current" : "h-5 w-5 fill-current"}>
          <path d="M12 3C6.48 3 2 6.56 2 10.95c0 2.82 1.86 5.3 4.66 6.72l-.94 3.46a.52.52 0 0 0 .77.58l4.1-2.72c.46.05.93.08 1.41.08 5.52 0 10-3.56 10-8.12S17.52 3 12 3Z" />
        </svg>
        {pending ? "연결 중…" : label}
      </a>
    </div>
  );
}
