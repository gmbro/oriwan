"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { IconArrowRight, IconCalendar, IconX } from "@/components/icons";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function NextSeasonNoticeModal({
  onClose,
  onCloseToday,
}: {
  onClose: () => void;
  onCloseToday: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) || [])
        .filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 py-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="modal-rise max-h-[calc(100dvh-32px)] w-[min(92vw,420px)] overflow-y-auto rounded-[28px] bg-white p-5 text-slate-950 shadow-2xl shadow-slate-950/25 ring-1 ring-slate-950/10 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="next-season-notice-title"
        aria-describedby="next-season-notice-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-lime-200 px-3 text-[11px] font-black text-lime-950">
            <IconCalendar size={14} /> 2026.09.23 START
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-950 hover:text-lime-200"
            aria-label="다음 시즌 공지 닫기"
          >
            <IconX size={18} />
          </button>
        </div>

        <h2 id="next-season-notice-title" className="mt-4 text-2xl font-black leading-tight sm:text-[28px]">
          다음 시즌 준비 중
        </h2>
        <div id="next-season-notice-description" className="mt-3 text-sm font-bold leading-6 text-slate-600">
          <p>다음 시즌은 9월 23일 시작합니다. 아래 기능을 차례로 준비하고 있어요.</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 marker:text-lime-600">
            <li>지난 시즌 기록·리포트 보관</li>
            <li>새 시즌 D-day·참가 안내</li>
            <li>멤버 서비스·상품 소개</li>
          </ul>
        </div>

        <div className="mt-5 grid gap-2">
          <Link
            href="/dashboard/report"
            onClick={onClose}
            className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-slate-950 px-4 text-sm font-black text-lime-200 transition hover:bg-slate-800"
          >
            지난 시즌 리포트 보기 <IconArrowRight size={16} />
          </Link>
          <button
            type="button"
            onClick={onCloseToday}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-200"
          >
            오늘은 그만보기
          </button>
        </div>
      </div>
    </div>
  );
}
