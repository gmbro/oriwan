"use client";

import { useEffect, useState } from "react";

type GiftClaim = {
  id: string;
  record_date: string;
  message: string;
  claimed_at: string;
};

type GiftStatus = {
  eligible: boolean;
  participant_name: string;
  record_date: string;
  claim: GiftClaim | null;
};

export function DailyGiftBox() {
  const [status, setStatus] = useState<GiftStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/me/gift-box", { cache: "no-store" })
      .then(async (response) => ({ response, json: await response.json() }))
      .then(({ response, json }) => {
        if (!active) return;
        if (!response.ok) {
          setMessage(json.error || "응원 상자를 불러오지 못했어요.");
          return;
        }
        setStatus(json);
        setMessage("");
      })
      .catch(() => {
        if (active) setMessage("응원 상자를 불러오지 못했어요.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const openGift = async () => {
    setOpening(true);
    setMessage("");
    try {
      const response = await fetch("/api/me/gift-box", { method: "POST" });
      const json = await response.json();
      if (!response.ok) {
        setMessage(json.error || "응원 상자를 열지 못했어요.");
        return;
      }
      setStatus((current) => current ? { ...current, claim: json.claim } : current);
    } catch {
      setMessage("응원 상자를 열지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <section className="relative mt-4 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#3182f6] via-[#4b8ef0] to-[#6b9be8] p-5 text-white shadow-xl shadow-blue-500/15 sm:p-6" aria-labelledby="daily-gift-title">
      <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full border-[28px] border-white/10" aria-hidden="true" />
      <div className="relative grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-[11px] font-black text-white/70">TODAY&apos;S CHEER</p>
          <h2 id="daily-gift-title" className="mt-1 text-xl font-black sm:text-2xl">오늘의 응원 상자</h2>
          {loading ? (
            <p className="mt-2 text-sm font-bold text-white/75">오늘의 인증을 확인하고 있어요…</p>
          ) : status?.claim ? (
            <p className="mt-3 text-[clamp(1.45rem,6vw,2.25rem)] font-black leading-tight">{status.claim.message}</p>
          ) : status?.eligible ? (
            <p className="mt-2 text-sm font-bold leading-6 text-white/85">오늘 인증 완료! 상자를 눌러 랜덤 응원을 받아보세요.</p>
          ) : (
            <p className="mt-2 text-sm font-bold leading-6 text-white/80">오늘 인증을 완료하면 이 상자를 열 수 있어요.</p>
          )}
          {message ? <p className="mt-3 rounded-xl bg-white/12 px-3 py-2 text-xs font-bold" role="status">{message}</p> : null}
        </div>

        <button
          type="button"
          onClick={openGift}
          disabled={loading || opening || !status?.eligible || Boolean(status?.claim)}
          className="group grid min-h-24 w-full place-items-center rounded-[24px] bg-white px-6 py-4 text-center text-blue-700 shadow-lg ring-1 ring-white/50 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white disabled:translate-y-0 disabled:cursor-default disabled:opacity-70 sm:w-40"
        >
          <span aria-hidden="true" className="text-4xl transition group-hover:scale-105">{status?.claim ? "🎉" : status?.eligible ? "🎁" : "🔒"}</span>
          <span className="mt-1 text-xs font-black">
            {loading ? "확인 중" : status?.claim ? "오늘 수령 완료" : status?.eligible ? opening ? "여는 중…" : "상자 열기" : "인증 후 열기"}
          </span>
        </button>
      </div>
    </section>
  );
}
