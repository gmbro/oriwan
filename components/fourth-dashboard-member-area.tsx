"use client";

import { ActivityIcon } from "./activity-icon";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import type { GiftStatus } from "@/components/daily-gift-box";
import type { CorrectiveExerciseResponse } from "@/components/corrective-exercise-application";
import type { TimeMachineStatus } from "@/components/time-machine-goal-box";
import { useOptionalFourthViewer } from "@/components/fourth-viewer-provider";
import { DASHBOARD_REFRESH_DOM_EVENT } from "@/lib/dashboard-refresh-contract";
import { createWarmRequest } from "@/lib/warm-request";
import type { MyActivityFeatureSeed } from "@/lib/my-activity-feature-seed";

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
const TimeMachineGoalBox = dynamic(
  () => import("@/components/time-machine-goal-box").then((module) => module.TimeMachineGoalBox),
  { loading: () => <div className="h-72 animate-pulse rounded-[24px] bg-slate-100" aria-label="목표 타임머신을 불러오는 중" /> },
);

const preloadFortune = () => void import("@/components/daily-fortune").catch(() => undefined);
const preloadGiftBox = () => void import("@/components/daily-gift-box").catch(() => undefined);
const preloadCorrectiveExercise = () => void import("@/components/corrective-exercise-application").catch(() => undefined);
const preloadTimeMachine = () => void import("@/components/time-machine-goal-box").catch(() => undefined);

type FeatureModal = "fortune" | "gift" | "corrective" | "time-machine" | null;

type GiftStatusResponse = Partial<GiftStatus> & { error?: string };

async function requestPersonalFeature<ResponsePayload>(
  path: string,
  isValid: (payload: Partial<ResponsePayload> & { error?: string }) => boolean,
  fallbackMessage: string,
) {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({})) as Partial<ResponsePayload> & { error?: string };
  if (!response.ok || !isValid(payload)) throw new Error(payload.error || fallbackMessage);
  return payload as ResponsePayload;
}

export function FourthDashboardMemberArea({
  displayName,
  embedded = false,
  preview = false,
  onOpenActivity,
}: {
  displayName?: string;
  embedded?: boolean;
  preview?: boolean;
  onOpenActivity?: (section: "fortune" | "gift" | "corrective" | "time-machine", seed?: MyActivityFeatureSeed) => void;
} = {}) {
  const viewerState = useOptionalFourthViewer();
  const viewer = viewerState?.viewer ?? null;
  const loading = viewerState?.loading ?? false;
  const authenticated = Boolean(preview || displayName || viewer?.authenticated);
  const connected = Boolean(preview || displayName || viewer?.approved_participant);
  const resolvedDisplayName = displayName || viewer?.display_name || "";
  const [modal, setModal] = useState<FeatureModal>(null);
  const [giftStatus, setGiftStatus] = useState<GiftStatus | null>(null);
  const [giftStatusError, setGiftStatusError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const giftStatusRequestRef = useRef(false);
  const [correctiveRequest, setCorrectiveRequest] = useState<Promise<CorrectiveExerciseResponse> | null>(null);
  const [timeMachineRequest, setTimeMachineRequest] = useState<Promise<TimeMachineStatus> | null>(null);
  const giftAvailable = Boolean(giftStatus?.eligible || giftStatus?.claim);
  const giftStatusLoading = connected && giftStatus === null && !giftStatusError;
  const [correctiveCache] = useState(() => createWarmRequest(() => requestPersonalFeature<CorrectiveExerciseResponse>(
    "/api/me/corrective-exercise",
    payload => typeof payload.accepting_applications === "boolean" && typeof payload.participant_name === "string",
    "교정운동 문의 정보를 불러오지 못했어요.",
  )));
  const [timeMachineCache] = useState(() => createWarmRequest(() => requestPersonalFeature<TimeMachineStatus>(
    "/api/me/time-machine",
    payload => payload.state === "empty" || payload.state === "locked" || payload.state === "opened",
    "목표 타임머신을 불러오지 못했어요.",
  )));

  const preloadCorrectiveData = useCallback(() => {
    if (!connected || preview) return null;
    const request = correctiveCache.read();
    // A warm-up failure is handled when the modal consumes the same promise.
    void request.catch(() => undefined);
    setCorrectiveRequest(request);
    return request;
  }, [connected, preview, correctiveCache, setCorrectiveRequest]);

  const preloadTimeMachineData = useCallback(() => {
    if (!connected || preview) return null;
    const request = timeMachineCache.read();
    void request.catch(() => undefined);
    setTimeMachineRequest(request);
    return request;
  }, [connected, preview, timeMachineCache, setTimeMachineRequest]);

  useEffect(() => {
    const invalidate = () => { correctiveCache.clear(); timeMachineCache.clear(); };
    window.addEventListener(DASHBOARD_REFRESH_DOM_EVENT, invalidate);
    return () => { invalidate(); window.removeEventListener(DASHBOARD_REFRESH_DOM_EVENT, invalidate); };
  }, [correctiveCache, timeMachineCache]);


  useEffect(() => {
    if (!authenticated || preview) {
      return;
    }
    const preloadMemberTools = () => {
      preloadFortune();
      preloadTimeMachine();
      if (connected) {
        preloadGiftBox();
        preloadCorrectiveExercise();
        preloadTimeMachineData();
        preloadCorrectiveData();
      }
    };
    // The feature area only renders for a signed-in viewer, so warm its small
    // chunks and read-only context immediately after the dashboard paints.
    let active = true;
    queueMicrotask(() => {
      if (active) preloadMemberTools();
    });
    return () => {
      active = false;
    };
  }, [authenticated, connected, preview, preloadCorrectiveData, preloadTimeMachineData]);

  useEffect(() => {
    if (connected) return;
    queueMicrotask(() => {
      setCorrectiveRequest(null);
      setTimeMachineRequest(null);
    });
  }, [connected]);

  useEffect(() => {
    if (!connected || preview) {
      queueMicrotask(() => setGiftStatus(null));
      return;
    }

    const controller = new AbortController();
    let queued = false;
    const refreshGiftStatus = async () => {
      if (controller.signal.aborted) return;
      if (giftStatusRequestRef.current) { queued = true; return; }
      giftStatusRequestRef.current = true;
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
      } finally {
        giftStatusRequestRef.current = false;
        if (queued && !controller.signal.aborted) { queued = false; void refreshGiftStatus(); }
      }
    };

    void refreshGiftStatus();
    const handleFocus = () => {
      void refreshGiftStatus();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshGiftStatus();
    };
    const giftTimer = window.setInterval(handleVisibility, 15000);
    window.addEventListener("focus", handleFocus);
    window.addEventListener(DASHBOARD_REFRESH_DOM_EVENT, handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      controller.abort();
      window.clearInterval(giftTimer);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(DASHBOARD_REFRESH_DOM_EVENT, handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [connected, preview]);

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
    if (onOpenActivity) {
      onOpenActivity(kind, {
        correctiveRequest: kind === "corrective" ? preloadCorrectiveData() ?? undefined : undefined,
        correctiveStatus: correctiveCache.peek(),
        timeMachineRequest: kind === "time-machine" ? preloadTimeMachineData() ?? undefined : undefined,
        timeMachineStatus: timeMachineCache.peek(),
        giftStatus,
        onGiftChange: setGiftStatus,
        onTimeMachineChange: value => setTimeMachineRequest(timeMachineCache.set(value)),
      });
      return;
    }
    lastTriggerRef.current = trigger;
    // Data warm-up already runs on pointer/focus. Repeating it here can start a
    // second request before React commits the first promise on pointer-down.
    if (kind === "fortune") preloadFortune();
    if (kind === "time-machine") {
      preloadTimeMachine();
    }
    if (kind === "gift") preloadGiftBox();
    if (kind === "corrective") {
      preloadCorrectiveExercise();
    }
    setModal(kind);
    // The dialog already exists in the DOM. Opening it inside the pointer event
    // avoids waiting for a post-paint effect before the user sees feedback.
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    window.requestAnimationFrame(() => dialogTitleRef.current?.focus());
  };

  const closeModal = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    setModal(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const modalTitle = modal === "fortune"
    ? "오늘 운세"
    : modal === "time-machine"
      ? "타임머신"
    : modal === "gift"
      ? "인증박스"
      : modal === "corrective"
        ? "교정운동"
        : "개인 기능";

  if ((!preview && loading) || !authenticated) return null;

  const actions = [
    {
      id: "time-machine" as const,
      icon: <ActivityIcon kind="time-machine" size={28}/>,
      title: "타임머신",
      description: connected
        ? "2027년 1월 1일에 열릴 목표를 보관해요"
        : "개인 멤버 연결 후 이용할 수 있어요",
      disabled: !connected,
      preload: () => {
        preloadTimeMachine();
        preloadTimeMachineData();
      },
    },
    {
      id: "gift" as const,
      icon: <ActivityIcon kind="gift" size={28}/>,
      title: "인증박스",
      description: giftStatus?.claim
        ? "오늘 받은 응원을 다시 확인해보세요"
        : giftStatusLoading
          ? "오늘 인증 기록을 확인하고 있어요"
          : connected
            ? "오늘 인증을 완료하면 열 수 있어요"
            : "개인 멤버 연결 후 이용할 수 있어요",
      disabled: !preview && !giftAvailable,
      preload: preloadGiftBox,
    },
    {
      id: "fortune" as const,
      icon: <ActivityIcon kind="fortune" size={28}/>,
      title: "오늘 운세",
      description: "행복한 오늘의 운세를 확인해보세요",
      disabled: false,
      preload: preloadFortune,
    },
    {
      id: "corrective" as const,
      icon: <ActivityIcon kind="corrective" size={28}/>,
      title: "교정운동",
      description: "교정운동이 필요하거나 궁금한 내용을 문의하시면 확인 후에 답변해드립니다.",
      disabled: !connected,
      preload: () => {
        preloadCorrectiveExercise();
        preloadCorrectiveData();
      },
    },
  ];

  const connectionMessage = viewer?.connection_status === "revoked"
    ? "개인 멤버 연결이 중지됐어요. 운영자에게 확인해주세요."
    : viewer?.connection_status === "setup_required" || viewer?.connection_status === "admin_missing"
      ? "개인 멤버 연결 설정을 준비하고 있어요. 잠시 후 다시 확인해주세요."
      : "개인 멤버 연결을 완료하지 못했어요. 다시 확인해주세요.";

  return (
    <>
      <section
        id="member-features"
        className={embedded ? "w-full" : "mx-auto mt-3 w-[var(--content-width)] scroll-mt-20 rounded-[24px] bg-white p-2 shadow-[0_10px_30px_rgba(25,31,40,0.06)] ring-1 ring-slate-950/5 sm:mt-4 sm:p-3"}
        aria-labelledby="member-features-title"
      >
        <h2 id="member-features-title" className="sr-only">개인 기능</h2>
        {!connected ? (
          <div className="mb-2 flex flex-col gap-3 rounded-[18px] bg-amber-50 px-4 py-4 ring-1 ring-amber-200/80 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold leading-6 text-amber-950" role="status">{connectionMessage}</p>
            <button
              type="button"
              onClick={() => void viewerState?.reload()}
              className="min-h-11 shrink-0 rounded-2xl bg-white px-4 text-xs font-black text-amber-900 ring-1 ring-amber-200"
            >
              다시 확인
            </button>
          </div>
        ) : null}
        <div className={`grid grid-cols-2 gap-2 ${embedded ? "" : "sm:grid-cols-4"}`}>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              aria-label={`${action.title}. ${action.description}${action.disabled ? ". 잠김" : ""}`}
              onPointerEnter={preview ? undefined : action.preload}
              onPointerDown={preview ? undefined : action.preload}
              onFocus={preview ? undefined : action.preload}
              onClick={(event) => openModal(action.id, event.currentTarget)}
              className="group flex min-h-[100px] min-w-0 touch-manipulation flex-col items-center justify-center gap-2 rounded-[18px] border border-slate-100 bg-slate-50 px-2 py-3 text-center hover:bg-slate-100 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden="true" className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">{action.icon}</span>
              <strong className="block break-keep text-[13px] font-black leading-5 tracking-[-0.02em] text-slate-950 sm:text-[15px]">{action.title}</strong>
            </button>
          ))}
        </div>
        {giftStatusError ? (
          <p className="px-3 pb-2 pt-3 text-xs font-semibold leading-5 text-slate-500" role="status">
            {giftStatusError}
          </p>
        ) : null}
      </section>

      {!onOpenActivity && <dialog
        ref={dialogRef}
        className={`${modal === "corrective" ? "w-[min(560px,calc(100%_-_24px))]" : "w-[min(520px,calc(100%_-_24px))]"} m-auto max-h-[92dvh] overflow-visible rounded-[30px] bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/45`}
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
          {modal === "time-machine" ? (
            <TimeMachineGoalBox
              initialRequest={timeMachineRequest ?? undefined}
              onStatusChange={(nextStatus) => {
                const request = timeMachineCache.set(nextStatus);
                setTimeMachineRequest(request);
              }}
            />
          ) : null}
          {modal === "gift" ? <DailyGiftBox initialStatus={giftStatus} onStatusChange={setGiftStatus} /> : null}
          {modal === "corrective" ? <CorrectiveExerciseApplication initialRequest={correctiveRequest ?? undefined} /> : null}
        </div>
      </dialog>}
    </>
  );
}
