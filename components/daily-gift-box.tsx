"use client";

import { useEffect, useState } from "react";

import { DEFAULT_GIFT_REWARDS, selectGiftReward } from "@/lib/gift-rewards";
import styles from "./daily-gift-box.module.css";

export type GiftClaim = {
  id: string;
  record_date: string;
  message: string;
  claimed_at: string;
};

export type GiftStatus = {
  eligible: boolean;
  participant_name: string;
  record_date: string;
  claim: GiftClaim | null;
};

type DailyGiftBoxProps = {
  preview?: boolean;
  initialStatus?: GiftStatus | null;
  onStatusChange?: (status: GiftStatus) => void;
};

async function readJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Partial<GiftStatus> & { error?: string; claim?: GiftClaim }>;
}

export function DailyGiftBox({ initialStatus = null, onStatusChange, preview = false }: DailyGiftBoxProps) {
  const [status, setStatus] = useState<GiftStatus | null>(initialStatus);
  const [loading, setLoading] = useState(!initialStatus);
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(Boolean(initialStatus?.claim));
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (initialStatus || preview) return;

    const controller = new AbortController();
    void fetch("/api/me/gift-box", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => ({ response, json: await readJson(response) }))
      .then(({ response, json }) => {
        if (!response.ok || typeof json.eligible !== "boolean" || !json.record_date) {
          throw new Error(json.error || "응원 상자를 불러오지 못했어요.");
        }
        const nextStatus = json as GiftStatus;
        setStatus(nextStatus);
        setOpened(Boolean(nextStatus.claim));
        onStatusChange?.(nextStatus);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "응원 상자를 불러오지 못했어요.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [initialStatus, onStatusChange, preview]);

  useEffect(() => {
    if (!initialStatus || opening) return;
    setStatus(initialStatus);
    setOpened(Boolean(initialStatus.claim));
    setLoading(false);
  }, [initialStatus, opening]);

  const openGift = async () => {
    if (!status?.eligible || status.claim || opening) return;
    setOpening(true);
    setOpened(false);
    setMessage("");

    const motionDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 5000;
    try {
      if (preview) {
        await new Promise(resolve => window.setTimeout(resolve, motionDelay));
        const ticket = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
        const reward = selectGiftReward(DEFAULT_GIFT_REWARDS, ticket);
        const nextStatus = { ...status, claim: { id: "preview", record_date: status.record_date, message: reward.kind === "prize" ? `🎁 ${reward.message}` : reward.message, claimed_at: new Date().toISOString() } };
        setStatus(nextStatus); setOpened(true); onStatusChange?.(nextStatus); return;
      }
      const [response] = await Promise.all([
        fetch("/api/me/gift-box", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
        new Promise((resolve) => window.setTimeout(resolve, motionDelay)),
      ]);
      const json = await readJson(response);
      if (!response.ok || !json.claim) {
        throw new Error(json.error || "응원 상자를 열지 못했어요.");
      }
      const nextStatus = { ...status, claim: json.claim };
      setStatus(nextStatus);
      setOpened(true);
      onStatusChange?.(nextStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "응원 상자를 열지 못했어요. 잠시 후 다시 시도해주세요.");
      setOpened(false);
    } finally {
      setOpening(false);
    }
  };

  if (!loading && status && !status.eligible && !status.claim) return null;

  return (
    <section className="space-y-4" aria-labelledby="daily-gift-title">
      <div>
        <h3 id="daily-gift-title" className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">오늘의 응원 상자</h3>
        <p className={`${styles.copy} mt-2 text-sm font-semibold text-slate-600`}>
          {status?.claim
            ? "오늘의 상자를 열었어요. 내일 인증을 마치면 새 상자가 도착해요."
            : "오늘 인증을 완료한 기록을 확인했어요. 상자를 열어 응원을 받아보세요."}
        </p>
      </div>

      <div className={`${styles.stage} ${opening ? styles.opening : ""} ${opened ? styles.opened : ""}`} aria-live="polite">
        {loading ? (
          <p className="text-sm font-bold text-slate-500">인증 기록을 확인하고 있어요.</p>
        ) : (
          <div className={styles.visual}>
            <div className={styles.box} aria-hidden="true">
              <div className={styles.sparkles}>{Array.from({length:16},(_,i)=><i key={i} style={{"--angle":`${i*22.5}deg`,"--color":["#ffce45","#ff78ad","#3182f6","#40c8a3"][i%4]} as React.CSSProperties} />)}</div>
              <div className={styles.body} />
              <div className={styles.lid} />
            </div>
            {status?.claim ? <p className={styles.message}><span className={styles.messageLabel}>오늘의 인증 보상</span>{status.claim.message}{status.claim.message.startsWith("🎁 ") && <span className={styles.prizeHelp}>보관함에 담았어요. 내 정보의 보관함에서 받은 항목을 확인하고 사용을 요청해주세요.</span>}</p> : null}
          </div>
        )}
      </div>

      {message ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700" role="status">{message}</p> : null}

      {!loading && status?.eligible && !status.claim ? (
        <button
          type="button"
          onClick={() => void openGift()}
          disabled={opening}
          className="min-h-14 w-full rounded-2xl bg-blue-600 px-5 text-base font-black text-white shadow-[0_8px_22px_rgba(49,130,246,0.2)] transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
        >
          {opening ? "상자를 여는 중" : "오늘의 상자 열기"}
        </button>
      ) : null}
    </section>
  );
}
