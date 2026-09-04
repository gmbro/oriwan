"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DailyFortune } from "@/components/daily-fortune";
import { DailyGiftBox } from "@/components/daily-gift-box";
import { useFourthViewer } from "@/components/fourth-viewer-provider";
import { KakaoLoginButton } from "@/components/kakao-login-button";

type FeatureModal = "fortune" | "gift" | "login" | "approval" | null;

export function FourthDashboardMemberArea() {
  const { viewer, loading, actionPending, error, logout } = useFourthViewer();
  const [modal, setModal] = useState<FeatureModal>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !modal || dialog.open) return;
    dialog.showModal();
    window.requestAnimationFrame(() => dialogTitleRef.current?.focus());
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modal]);

  const openModal = (kind: Exclude<FeatureModal, null>, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setModal(kind);
  };

  const closeModal = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    setModal(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const openFortune = (trigger: HTMLButtonElement) => {
    openModal(viewer?.authenticated ? "fortune" : "login", trigger);
  };

  const openGift = (trigger: HTMLButtonElement) => {
    if (!viewer?.authenticated) openModal("login", trigger);
    else if (!viewer.approved_participant) openModal("approval", trigger);
    else openModal("gift", trigger);
  };

  const modalTitle = modal === "fortune"
    ? "오늘의 운세"
    : modal === "gift"
      ? "오늘의 응원 상자"
      : modal === "approval"
        ? "크루 연결 확인 중"
        : "카카오로 시작하기";

  return (
    <>
      <section
        id="member-features"
        className="mx-auto mt-3 w-[calc(100%_-_var(--page-gutter)_*_2)] max-w-[1200px] rounded-[22px] bg-white p-2 shadow-[0_10px_30px_rgba(25,31,40,0.06)] ring-1 ring-slate-950/5 sm:mt-4 sm:rounded-[26px] sm:p-4"
        aria-labelledby="member-features-title"
      >
        <div className="mb-2.5 hidden min-h-8 items-center justify-between gap-3 px-1 sm:mb-3 sm:flex">
          <div className="min-w-0">
            <h2 id="member-features-title" className="truncate text-[12px] font-black text-slate-900 sm:text-sm">
              {loading
                ? "개인 기능을 확인하고 있어요"
                : viewer?.authenticated
                  ? `${viewer.display_name || "카카오 사용자"}님의 개인 화면`
                  : "비로그인 공개 보기"}
            </h2>
            <p className="mt-0.5 hidden truncate text-[10px] font-bold text-slate-500 sm:block">
              {viewer?.authenticated
                ? viewer.verified_name
                  ? "운영자가 확인한 이름이 적용됐어요."
                  : "카카오 이름을 사용하며 운영자가 크루 확인 이름으로 변경할 수 있어요."
                : "공개 기록은 그대로 보고, 개인 기능만 로그인 후 이용해요."}
            </p>
          </div>
          {viewer?.authenticated ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <Link href="/me" className="inline-flex min-h-11 items-center rounded-full bg-slate-100 px-3 text-[11px] font-black text-slate-700">
                내 정보
              </Link>
              <button
                type="button"
                disabled={actionPending}
                onClick={() => void logout()}
                className="min-h-11 rounded-full px-2.5 text-[11px] font-black text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                {actionPending ? "처리 중" : "로그아웃"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={(event) => openFortune(event.currentTarget)}
            className="group flex min-h-[68px] items-center gap-2 rounded-[18px] bg-gradient-to-br from-violet-50 to-blue-50 p-2 text-left ring-1 ring-violet-100 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:translate-y-0 disabled:opacity-60 sm:min-h-[96px] sm:gap-3 sm:rounded-[22px] sm:p-4"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-base shadow-sm ring-1 ring-violet-100 sm:h-12 sm:w-12 sm:rounded-2xl sm:text-2xl" aria-hidden="true">✨</span>
            <span className="min-w-0">
              <strong className="block text-[12px] font-black leading-4 text-slate-950 sm:text-base">오늘의 운세</strong>
              <small className="mt-1 block text-[10px] font-bold leading-4 text-violet-600 sm:text-xs">
                {viewer?.authenticated ? "인증 없이 바로 확인" : "로그인 후 확인"}
              </small>
            </span>
            <span className="ml-auto hidden text-violet-400 sm:block" aria-hidden="true">›</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={(event) => openGift(event.currentTarget)}
            className="group flex min-h-[68px] items-center gap-2 rounded-[18px] bg-gradient-to-br from-blue-50 to-cyan-50 p-2 text-left ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:translate-y-0 disabled:opacity-60 sm:min-h-[96px] sm:gap-3 sm:rounded-[22px] sm:p-4"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-base shadow-sm ring-1 ring-blue-100 sm:h-12 sm:w-12 sm:rounded-2xl sm:text-2xl" aria-hidden="true">🎁</span>
            <span className="min-w-0">
              <strong className="block text-[12px] font-black leading-4 text-slate-950 sm:text-base">응원 상자</strong>
              <small className="mt-1 block text-[10px] font-bold leading-4 text-blue-600 sm:text-xs">
                {!viewer?.authenticated
                  ? "로그인 후 이용"
                  : viewer.approved_participant
                    ? "오늘 인증 후 열기"
                    : "크루 연결 후 이용"}
              </small>
            </span>
            <span className="ml-auto hidden text-blue-400 sm:block" aria-hidden="true">›</span>
          </button>
        </div>

        {error ? <p className="mt-2 px-1 text-[10px] font-bold text-rose-600" role="status">{error}</p> : null}
      </section>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[92dvh] w-[min(520px,calc(100%_-_24px))] overflow-visible rounded-[30px] bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/45 max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-[30px]"
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
          <div className="flex items-center justify-between gap-4 px-1 pb-3">
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

          {modal === "fortune" ? <DailyFortune /> : null}
          {modal === "gift" ? <div className="-mt-4"><DailyGiftBox /></div> : null}
          {modal === "login" ? (
            <div className="rounded-[26px] bg-slate-50 p-5 text-center ring-1 ring-slate-950/5">
              <span className="text-4xl" aria-hidden="true">👋</span>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                카카오 로그인 후 운세를 바로 보고, 크루 인증을 마치면 응원 상자도 열 수 있어요.
              </p>
              <div className="mt-5"><KakaoLoginButton nextPath="/4th#member-features" label="카카오로 시작하기" /></div>
              <button type="button" onClick={closeModal} className="mt-2 min-h-11 w-full text-xs font-black text-slate-500">계속 둘러보기</button>
            </div>
          ) : null}
          {modal === "approval" ? (
            <div className="rounded-[26px] bg-blue-50 p-5 ring-1 ring-blue-100">
              <span className="text-4xl" aria-hidden="true">🔗</span>
              <h3 className="mt-3 text-lg font-black text-slate-950">운영자가 크루를 연결하고 있어요</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                운세는 지금 바로 볼 수 있어요. 응원 상자는 운영자가 카카오 계정과 크루를 연결한 뒤, 오늘 인증을 완료하면 열립니다.
              </p>
              <Link href="/me" className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white">내 연결 상태 보기</Link>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
