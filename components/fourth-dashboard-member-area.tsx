"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useFourthViewer } from "@/components/fourth-viewer-provider";
import { KakaoLoginButton } from "@/components/kakao-login-button";

const DailyFortune = dynamic(() => import("@/components/daily-fortune").then((module) => module.DailyFortune), {
  loading: () => <div className="h-44 animate-pulse rounded-[24px] bg-slate-100" aria-label="오늘의 운세를 불러오는 중" />,
});
const DailyGiftBox = dynamic(() => import("@/components/daily-gift-box").then((module) => module.DailyGiftBox), {
  loading: () => <div className="h-56 animate-pulse rounded-[24px] bg-slate-100" aria-label="응원 상자를 불러오는 중" />,
});
const CorrectiveExerciseApplication = dynamic(
  () => import("@/components/corrective-exercise-application").then((module) => module.CorrectiveExerciseApplication),
  { loading: () => <div className="h-72 animate-pulse rounded-[24px] bg-slate-100" aria-label="교정운동 신청을 불러오는 중" /> },
);

type FeatureModal = "fortune" | "gift" | "corrective" | "login" | "approval" | null;

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

  const openCorrective = (trigger: HTMLButtonElement) => {
    if (!viewer?.authenticated) openModal("login", trigger);
    else if (!viewer.approved_participant) openModal("approval", trigger);
    else openModal("corrective", trigger);
  };

  const modalTitle = modal === "fortune"
    ? "오늘의 운세"
    : modal === "gift"
      ? "오늘의 응원 상자"
      : modal === "corrective"
        ? "교정운동 신청"
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
        {loading ? (
          <>
            <h2 id="member-features-title" className="sr-only">개인 기능을 불러오는 중</h2>
            <div className="grid grid-cols-3 gap-2" aria-hidden="true">
              <div className="h-28 animate-pulse rounded-[20px] bg-slate-100" />
              <div className="h-28 animate-pulse rounded-[20px] bg-slate-100" />
              <div className="h-28 animate-pulse rounded-[20px] bg-slate-100" />
            </div>
          </>
        ) : !viewer?.authenticated ? (
          <div className="grid gap-4 rounded-[20px] bg-gradient-to-br from-slate-50 to-blue-50 p-4 ring-1 ring-slate-950/5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:rounded-[22px] sm:p-5">
            <div className="min-w-0">
              <p className="text-[11px] font-black tracking-[0.08em] text-blue-600">PERSONAL</p>
              <h2 id="member-features-title" className="mt-1 text-lg font-black text-slate-950 sm:text-xl">카카오로 로그인하기</h2>
              <p className="mt-1.5 text-xs font-bold leading-5 text-slate-600 sm:text-sm sm:leading-6">
                로그인하면 오늘의 운세, 인증 후 응원 상자, 교정운동 신청을 이용할 수 있어요.
              </p>
            </div>
            <div className="sm:min-w-52">
              <KakaoLoginButton nextPath="/4th#member-features" label="카카오로 시작하기" />
            </div>
          </div>
        ) : (
          <>
            <div className="mb-2.5 flex min-h-9 items-center justify-between gap-2 px-1 sm:mb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black tracking-[0.08em] text-blue-600 sm:text-[11px]">PERSONAL</p>
                <h2 id="member-features-title" className="truncate text-[12px] font-black text-slate-900 sm:text-sm">
                  {viewer.display_name || "카카오 사용자"}님의 개인 화면
                </h2>
                <p className="mt-0.5 hidden truncate text-[10px] font-bold text-slate-500 sm:block">
                  {viewer.verified_name
                    ? "운영자가 확인한 이름이 적용됐어요."
                    : "카카오 이름을 사용하며 운영자가 크루 확인 이름으로 변경할 수 있어요."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link href="/me" className="inline-flex min-h-10 items-center rounded-full bg-slate-100 px-3 text-[11px] font-black text-slate-700 sm:min-h-11">
                  내 정보
                </Link>
                <button
                  type="button"
                  disabled={actionPending}
                  onClick={() => void logout()}
                  className="min-h-10 rounded-full px-2 text-[11px] font-black text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 sm:min-h-11 sm:px-2.5"
                >
                  {actionPending ? "처리 중" : "로그아웃"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={(event) => openFortune(event.currentTarget)}
                className="group flex min-h-[120px] min-w-0 flex-col justify-between rounded-[18px] bg-gradient-to-br from-violet-50 to-blue-50 p-3 text-left ring-1 ring-violet-100 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-400 sm:min-h-[124px] sm:rounded-[22px] sm:p-4"
              >
                <span className="flex w-full items-start justify-between gap-1">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-base shadow-sm ring-1 ring-violet-100 sm:h-11 sm:w-11 sm:rounded-2xl sm:text-xl" aria-hidden="true">✨</span>
                  <span className="text-violet-400" aria-hidden="true">›</span>
                </span>
                <span className="mt-2 min-w-0">
                  <strong className="block text-[12px] font-black leading-4 text-slate-950 sm:text-[15px] sm:leading-5">오늘의 운세</strong>
                  <small className="mt-1 block text-[11px] font-bold leading-4 text-violet-600">인증 없이 바로 확인</small>
                </span>
              </button>

              <button
                type="button"
                onClick={(event) => openGift(event.currentTarget)}
                className="group flex min-h-[120px] min-w-0 flex-col justify-between rounded-[18px] bg-gradient-to-br from-blue-50 to-cyan-50 p-3 text-left ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:min-h-[124px] sm:rounded-[22px] sm:p-4"
              >
                <span className="flex w-full items-start justify-between gap-1">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-base shadow-sm ring-1 ring-blue-100 sm:h-11 sm:w-11 sm:rounded-2xl sm:text-xl" aria-hidden="true">🎁</span>
                  <span className="text-blue-400" aria-hidden="true">›</span>
                </span>
                <span className="mt-2 min-w-0">
                  <strong className="block text-[12px] font-black leading-4 text-slate-950 sm:text-[15px] sm:leading-5">응원 상자</strong>
                  <small className="mt-1 block text-[11px] font-bold leading-4 text-blue-600">
                    {viewer.approved_participant ? "오늘 인증 후 열기" : "크루 연결 후 이용"}
                  </small>
                </span>
              </button>

              <button
                type="button"
                onClick={(event) => openCorrective(event.currentTarget)}
                className="group flex min-h-[120px] min-w-0 flex-col justify-between rounded-[18px] bg-gradient-to-br from-emerald-50 to-teal-50 p-3 text-left ring-1 ring-emerald-100 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:min-h-[124px] sm:rounded-[22px] sm:p-4"
              >
                <span className="flex w-full items-start justify-between gap-1">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-base shadow-sm ring-1 ring-emerald-100 sm:h-11 sm:w-11 sm:rounded-2xl sm:text-xl" aria-hidden="true">🧘</span>
                  <span className="text-emerald-500" aria-hidden="true">›</span>
                </span>
                <span className="mt-2 min-w-0">
                  <strong className="block text-[12px] font-black leading-4 text-slate-950 sm:text-[15px] sm:leading-5">교정운동</strong>
                  <small className="mt-1 block text-[11px] font-bold leading-4 text-emerald-700">
                    {viewer.approved_participant ? "가능한 날짜로 신청" : "크루 연결 후 신청"}
                  </small>
                </span>
              </button>
            </div>
          </>
        )}

        {error ? <p className="mt-2 px-1 text-[10px] font-bold text-rose-600" role="status">{error}</p> : null}
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
          <div className="sticky -top-4 z-10 mb-3 flex items-center justify-between gap-4 border-b border-slate-100 bg-white/95 px-1 py-3 backdrop-blur sm:-top-6 sm:py-4">
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
          {modal === "corrective" ? <CorrectiveExerciseApplication /> : null}
          {modal === "login" ? (
            <div className="rounded-[26px] bg-slate-50 p-5 text-center ring-1 ring-slate-950/5">
              <span className="text-4xl" aria-hidden="true">👋</span>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                카카오 로그인 후 운세를 바로 보고, 크루 연결 뒤 응원 상자와 교정운동 신청도 이용할 수 있어요.
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
                운세는 지금 바로 볼 수 있어요. 운영자가 카카오 계정과 크루를 연결하면 응원 상자와 교정운동 신청도 이용할 수 있습니다.
              </p>
              <Link href="/me" className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white">내 연결 상태 보기</Link>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
