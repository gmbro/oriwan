"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { GiftStatus } from "@/components/daily-gift-box";
import { useOptionalFourthViewer } from "@/components/fourth-viewer-provider";
import { DASHBOARD_REFRESH_DOM_EVENT } from "@/lib/dashboard-refresh";

const DailyFortune = dynamic(() => import("@/components/daily-fortune").then((module) => module.DailyFortune), {
  loading: () => <div className="h-72 animate-pulse rounded-[24px] bg-slate-100" aria-label="오늘의 운세를 불러오는 중" />,
});
const DailyGiftBox = dynamic(() => import("@/components/daily-gift-box").then((module) => module.DailyGiftBox), {
  loading: () => <div className="h-72 animate-pulse rounded-[24px] bg-slate-100" aria-label="응원 상자를 불러오는 중" />,
});
const CorrectiveExerciseApplication = dynamic(
  () => import("@/components/corrective-exercise-application").then((module) => module.CorrectiveExerciseApplication),
  { loading: () => <div className="h-72 animate-pulse rounded-[24px] bg-slate-100" aria-label="교정운동 문의를 불러오는 중" /> },
);

type FeatureModal = "fortune" | "gift" | "corrective" | null;

type GiftStatusResponse = Partial<GiftStatus> & { error?: string };

export function FourthDashboardMemberArea({
  displayName,
  embedded = false,
}: {
  displayName?: string;
  embedded?: boolean;
} = {}) {
  const viewerState = useOptionalFourthViewer();
  const viewer = viewerState?.viewer ?? null;
  const loading = viewerState?.loading ?? false;
  const authenticated = Boolean(displayName || viewer?.authenticated);
  const resolvedDisplayName = displayName || viewer?.display_name || "";
  const [modal, setModal] = useState<FeatureModal>(null);
  const [giftStatus, setGiftStatus] = useState<GiftStatus | null>(null);
  const [giftStatusError, setGiftStatusError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const giftAvailable = Boolean(giftStatus?.eligible || giftStatus?.claim);

  useEffect(() => {
    if (!authenticated) {
      queueMicrotask(() => setGiftStatus(null));
      return;
    }

    const controller = new AbortController();
    const refreshGiftStatus = async () => {
      try {
        const response = await fetch("/api/me/gift-box", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({})) as GiftStatusResponse;
        if (response.ok && typeof payload.eligible === "boolean" && payload.record_date && payload.participant_name) {
          setGiftStatus(payload as GiftStatus);
          setGiftStatusError("");
        } else if (response.status !== 403) {
          setGiftStatusError(payload.error || "응원 상자 상태를 확인하지 못했어요.");
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setGiftStatusError("응원 상자 상태를 확인하지 못했어요. 잠시 후 다시 확인해주세요.");
        }
      }
    };

    void refreshGiftStatus();
    const intervalId = giftAvailable ? null : window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshGiftStatus();
    }, 30_000);
    const handleFocus = () => void refreshGiftStatus();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshGiftStatus();
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener(DASHBOARD_REFRESH_DOM_EVENT, handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      controller.abort();
      if (intervalId !== null) window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(DASHBOARD_REFRESH_DOM_EVENT, handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [authenticated, giftAvailable]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!authenticated || !dialog || !modal || dialog.open) return;
    dialog.showModal();
    window.requestAnimationFrame(() => dialogTitleRef.current?.focus());
  }, [authenticated, modal]);

  useEffect(() => {
    if (!authenticated || !modal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [authenticated, modal]);

  useEffect(() => {
    if (!authenticated || embedded || window.location.hash !== "#member-features") return;
    window.requestAnimationFrame(() => {
      document.getElementById("member-features")?.scrollIntoView({ block: "start" });
    });
  }, [authenticated, embedded]);

  const openModal = (kind: Exclude<FeatureModal, null>, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setModal(kind);
  };

  const closeModal = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    setModal(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const modalTitle = modal === "fortune"
    ? "오늘의 운세"
    : modal === "gift"
      ? "오늘의 응원 상자"
      : modal === "corrective"
        ? "교정운동 문의"
        : "개인 기능";

  if (loading || !authenticated) return null;

  const actions = [
    ...(giftAvailable ? [{
      id: "gift" as const,
      title: "오늘의 응원 상자",
      description: giftStatus?.claim ? "오늘 받은 응원 다시 보기" : "인증 완료 보상 열기",
      action: giftStatus?.claim ? "다시 보기" : "열기",
    }] : []),
    {
      id: "fortune" as const,
      title: "오늘의 운세",
      description: "내 정보로 오늘의 흐름 확인",
      action: "보기",
    },
    {
      id: "corrective" as const,
      title: "교정운동 문의",
      description: "가능한 일정과 불편한 움직임 전달",
      action: "문의",
    },
  ];

  return (
    <>
      <section
        id="member-features"
        className={`${embedded ? "mt-5 w-full" : "mx-auto mt-3 w-[calc(100%_-_var(--page-gutter)_*_2)] max-w-[1200px] sm:mt-4"} scroll-mt-20 rounded-[24px] bg-white p-2 shadow-[0_10px_30px_rgba(25,31,40,0.06)] ring-1 ring-slate-950/5 sm:p-3`}
        aria-labelledby="member-features-title"
      >
        <h2 id="member-features-title" className="sr-only">개인 기능</h2>
        <div className={`grid gap-2 ${actions.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={(event) => openModal(action.id, event.currentTarget)}
              className="group flex min-h-[84px] items-center justify-between gap-4 rounded-[18px] bg-slate-50 px-4 py-4 text-left ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:min-h-[100px] sm:flex-col sm:items-start sm:justify-between"
            >
              <span className="min-w-0">
                <strong className="block text-[15px] font-black tracking-[-0.02em] text-slate-950">{action.title}</strong>
                <small className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{action.description}</small>
              </span>
              <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-blue-600 ring-1 ring-slate-200 transition group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-600">
                {action.action}
              </span>
            </button>
          ))}
        </div>
        {giftStatusError ? (
          <p className="px-3 pb-2 pt-3 text-xs font-semibold leading-5 text-slate-500" role="status">
            {giftStatusError}
          </p>
        ) : null}
      </section>

      <dialog
        ref={dialogRef}
        className={`${modal === "corrective" ? "w-[min(720px,calc(100%_-_24px))]" : "w-[min(520px,calc(100%_-_24px))]"} m-auto max-h-[92dvh] overflow-visible rounded-[30px] bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/45 max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-[30px]`}
        aria-labelledby="member-feature-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}
        onClose={() => setModal(null)}
      >
        <div className="max-h-[92dvh] overflow-y-auto p-4 pb-[max(24px,env(safe-area-inset-bottom))] sm:p-6">
          <div className="sticky -top-4 z-10 mb-4 flex items-center justify-between gap-4 border-b border-slate-100 bg-white/95 px-1 py-3 backdrop-blur sm:-top-6 sm:py-4">
            <h2 id="member-feature-dialog-title" ref={dialogTitleRef} tabIndex={-1} className="text-lg font-black outline-none">
              {modalTitle}
            </h2>
            <button
              type="button"
              aria-label="창 닫기"
              onClick={closeModal}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-xl font-black text-slate-600 transition hover:bg-slate-200"
            >
              ×
            </button>
          </div>

          {modal === "fortune" ? <DailyFortune defaultName={resolvedDisplayName} /> : null}
          {modal === "gift" ? <DailyGiftBox initialStatus={giftStatus} onStatusChange={setGiftStatus} /> : null}
          {modal === "corrective" ? <CorrectiveExerciseApplication /> : null}
        </div>
      </dialog>
    </>
  );
}
