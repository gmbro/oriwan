"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import {
  MAX_CORRECTIVE_INQUIRY_ADDITIONAL_LENGTH,
  MAX_CORRECTIVE_INQUIRY_ONSET_LENGTH,
  MAX_CORRECTIVE_INQUIRY_PAIN_AREA_LENGTH,
  MAX_CORRECTIVE_INQUIRY_TRIGGER_LENGTH,
  parseCorrectiveInquiryInput,
} from "@/lib/corrective-exercise-contract";

export type CorrectiveExerciseResponse = {
  participant_name: string;
  accepting_applications: boolean;
};

type InquiryDraft = {
  pain_area: string;
  pain_onset: string;
  aggravating_situation: string;
  additional_question: string;
};

const emptyInquiryDraft = (): InquiryDraft => ({
  pain_area: "",
  pain_onset: "",
  aggravating_situation: "",
  additional_question: "",
});

function safeJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

function getErrorMessage(payload: Record<string, unknown>, fallback: string) {
  return typeof payload.error === "string" && payload.error.trim() ? payload.error : fallback;
}

export function CorrectiveExerciseApplication({
  initialRequest,
  initialStatus,
}: {
  initialRequest?: Promise<CorrectiveExerciseResponse>;
  initialStatus?: CorrectiveExerciseResponse;
} = {}) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const requestConfirmRef = useRef<HTMLButtonElement>(null);
  const cancelConfirmRef = useRef<HTMLButtonElement>(null);
  const submitConfirmRef = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<CorrectiveExerciseResponse | null>(initialStatus ?? null);
  const [loading, setLoading] = useState(!initialStatus);
  const [retryKey, setRetryKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [draft, setDraft] = useState<InquiryDraft>(emptyInquiryDraft);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const request = retryKey === 0 && initialRequest ? initialRequest : fetch("/api/me/corrective-exercise", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await safeJson(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, response.status === 503
          ? "교정운동 문의를 준비하고 있어요. 잠시 후 다시 확인해주세요."
          : "교정운동 문의 정보를 불러오지 못했어요."));
      }
      return payload as unknown as CorrectiveExerciseResponse;
    });

    void request
      .then((payload) => {
        if (controller.signal.aborted) return;
        setData(payload);
        setError("");
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError("교정운동 문의 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [initialRequest, retryKey]);

  useEffect(() => {
    if (confirmOpen) cancelConfirmRef.current?.focus();
  }, [confirmOpen]);

  const updateDraft = <Key extends keyof InquiryDraft>(key: Key, value: InquiryDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
    setSuccessMessage("");
  };

  const requestConfirmation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const parsed = parseCorrectiveInquiryInput(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setConfirmationMessage(parsed.value.inquiry_message);
    setConfirmOpen(true);
  };

  const restoreRequestFocus = () => {
    window.requestAnimationFrame(() => requestConfirmRef.current?.focus());
  };

  const closeConfirmation = () => {
    if (submitting) return;
    setConfirmOpen(false);
    restoreRequestFocus();
  };

  const submitApplication = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/me/corrective-exercise", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setError(getErrorMessage(payload, "문의를 접수하지 못했어요. 내용을 확인하고 다시 시도해주세요."));
        setConfirmOpen(false);
        restoreRequestFocus();
        return;
      }

      // Every successful send starts a fresh draft; previous inquiries remain in the operator history.
      setDraft(emptyInquiryDraft());
      setConfirmationMessage("");
      setConfirmOpen(false);
      setSuccessMessage("문의가 접수됐어요. 바로 새 문의를 남길 수 있어요.");
      window.requestAnimationFrame(() => firstFieldRef.current?.focus());
    } catch {
      setError("문의를 접수하지 못했어요. 잠시 후 다시 시도해주세요.");
      setConfirmOpen(false);
      restoreRequestFocus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeConfirmation();
      return;
    }
    if (event.key !== "Tab") return;
    if (event.shiftKey && document.activeElement === cancelConfirmRef.current) {
      event.preventDefault();
      submitConfirmRef.current?.focus();
    } else if (!event.shiftKey && document.activeElement === submitConfirmRef.current) {
      event.preventDefault();
      cancelConfirmRef.current?.focus();
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-label="교정운동 문의 정보를 불러오는 중">
        <div className="h-28 animate-pulse rounded-[24px] bg-slate-100" />
        <div className="h-56 animate-pulse rounded-[24px] bg-slate-100" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[24px] bg-slate-50 p-5 text-center ring-1 ring-slate-950/5">
        <h3 className="text-lg font-black text-slate-950">문의를 불러오지 못했어요</h3>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{error || "잠시 후 다시 확인해주세요."}</p>
        <button
          type="button"
          onClick={() => {
            setError("");
            setLoading(true);
            setRetryKey((current) => current + 1);
          }}
          className="mt-4 min-h-12 w-full rounded-2xl bg-slate-900 px-4 text-sm font-black text-white"
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  if (!data.accepting_applications) {
    return (
      <div className="rounded-[24px] bg-slate-50 p-5 text-center ring-1 ring-slate-950/5">
        <h3 className="text-lg font-black text-slate-950">교정운동 문의를 준비하고 있어요</h3>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600">잠시 후 다시 확인해주세요.</p>
      </div>
    );
  }

  return (
    <>
      <form className="space-y-4" onSubmit={requestConfirmation} noValidate>
        <div className="rounded-[24px] bg-blue-50/80 p-5 ring-1 ring-blue-100">
          <p className="text-[11px] font-black text-blue-600">교정운동 문의</p>
          <h3 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">
            불편했던 순간을 간단히 적어주세요.
          </h3>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
            네 가지 짧은 답변이면 충분해요. 확인 후 개인 카톡으로 연락드리겠습니다.
          </p>
        </div>

        <div className="space-y-3 rounded-[24px] bg-white p-1 sm:p-2">
          <label className="block rounded-[20px] bg-slate-50 px-4 py-3.5 ring-1 ring-slate-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500">
            <span className="block text-sm font-black text-slate-950">통증 부위</span>
            <span className="mt-1 block text-xs font-medium text-slate-500">예: 오른쪽 무릎 앞쪽</span>
            <input
              ref={firstFieldRef}
              value={draft.pain_area}
              onChange={(event) => updateDraft("pain_area", event.target.value.slice(0, MAX_CORRECTIVE_INQUIRY_PAIN_AREA_LENGTH))}
              maxLength={MAX_CORRECTIVE_INQUIRY_PAIN_AREA_LENGTH}
              required
              placeholder="불편한 부위를 적어주세요"
              className="mt-3 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="block rounded-[20px] bg-slate-50 px-4 py-3.5 ring-1 ring-slate-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500">
            <span className="block text-sm font-black text-slate-950">언제부터 불편했나요?</span>
            <span className="mt-1 block text-xs font-medium text-slate-500">예: 지난주 5km 러닝 뒤부터</span>
            <input
              value={draft.pain_onset}
              onChange={(event) => updateDraft("pain_onset", event.target.value.slice(0, MAX_CORRECTIVE_INQUIRY_ONSET_LENGTH))}
              maxLength={MAX_CORRECTIVE_INQUIRY_ONSET_LENGTH}
              required
              placeholder="시작된 시점을 적어주세요"
              className="mt-3 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="block rounded-[20px] bg-slate-50 px-4 py-3.5 ring-1 ring-slate-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500">
            <span className="block text-sm font-black text-slate-950">어떨 때 더 불편한가요?</span>
            <span className="mt-1 block text-xs font-medium text-slate-500">예: 계단을 내려갈 때, 오래 앉아 있을 때</span>
            <input
              value={draft.aggravating_situation}
              onChange={(event) => updateDraft("aggravating_situation", event.target.value.slice(0, MAX_CORRECTIVE_INQUIRY_TRIGGER_LENGTH))}
              maxLength={MAX_CORRECTIVE_INQUIRY_TRIGGER_LENGTH}
              required
              placeholder="움직임이나 상황을 적어주세요"
              className="mt-3 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="block rounded-[20px] bg-slate-50 px-4 py-3.5 ring-1 ring-slate-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500">
            <span className="block text-sm font-black text-slate-950">그 밖에 문의 <em className="not-italic font-medium text-slate-400">선택</em></span>
            <textarea
              value={draft.additional_question}
              onChange={(event) => updateDraft("additional_question", event.target.value.slice(0, MAX_CORRECTIVE_INQUIRY_ADDITIONAL_LENGTH))}
              maxLength={MAX_CORRECTIVE_INQUIRY_ADDITIONAL_LENGTH}
              rows={3}
              placeholder="궁금한 점이나 참고할 내용을 적어주세요"
              className="mt-3 w-full resize-y bg-transparent text-sm font-semibold leading-6 text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        {successMessage ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-700" role="status">{successMessage}</p> : null}
        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-700" role="alert">{error}</p> : null}

        <button ref={requestConfirmRef} type="submit" className="min-h-14 w-full rounded-2xl bg-blue-600 px-5 text-base font-black text-white shadow-[0_8px_22px_rgba(49,130,246,0.22)] transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
          문의하기
        </button>
      </form>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="corrective-confirm-title"
          onKeyDown={handleConfirmKeyDown}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConfirmation();
          }}
        >
          <div className="w-full max-w-sm rounded-[26px] bg-white p-5 text-center shadow-2xl ring-1 ring-slate-950/5 sm:p-6">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-blue-50 text-2xl" aria-hidden="true">💬</span>
            <h4 id="corrective-confirm-title" className="mt-4 break-keep text-lg font-black leading-7 text-slate-950">
              확인 후 개인 카톡으로 연락드리겠습니다!
            </h4>
            <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 px-4 py-3 text-left text-xs font-medium leading-5 text-slate-600">
              {confirmationMessage}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                ref={cancelConfirmRef}
                type="button"
                disabled={submitting}
                onClick={closeConfirmation}
                className="min-h-12 rounded-2xl bg-slate-100 px-3 text-sm font-black text-slate-700 disabled:opacity-50"
              >
                문의 취소하기
              </button>
              <button
                ref={submitConfirmRef}
                type="button"
                disabled={submitting}
                onClick={() => void submitApplication()}
                className="min-h-12 rounded-2xl bg-blue-600 px-3 text-sm font-black text-white disabled:opacity-60"
              >
                {submitting ? "접수 중…" : "확인"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
