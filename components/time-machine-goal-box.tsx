"use client";

import { type CSSProperties, FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  MAX_TIME_MACHINE_COMMITMENT_LENGTH,
  MAX_TIME_MACHINE_GOAL_TITLE_LENGTH,
  type TimeMachineGoalInput,
} from "@/lib/time-machine-contract";
import { ActivityIcon } from "./activity-icon";
import styles from "./time-machine-goal-box.module.css";

type TimeMachineGoal = {
  title: string;
  detail: string;
  commitment: string;
  created_at: string;
};

export type TimeMachineStatus = {
  state: "empty" | "locked" | "opened";
  progress: number;
  server_now: string;
  unlock_at: string;
  goal?: TimeMachineGoal;
  error?: string;
};

async function readJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<TimeMachineStatus>;
}

function remainingDays(unlockAt: string, serverNow: string) {
  const remaining = Math.max(0, Date.parse(unlockAt) - Date.parse(serverNow));
  return Math.ceil(remaining / 86_400_000);
}

export function TimeMachineGoalBox({
  initialRequest,
  initialStatus,
  active = true,
  onStatusChange,
}: {
  initialRequest?: Promise<TimeMachineStatus>;
  initialStatus?: TimeMachineStatus;
  active?: boolean;
  onStatusChange?: (status: TimeMachineStatus) => void;
} = {}) {
  const [status, setStatus] = useState<TimeMachineStatus | null>(initialStatus ?? null);
  const [loading, setLoading] = useState(!initialStatus);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<TimeMachineGoalInput>({
    goal_title: "",
    goal_detail: "",
    commitment: "",
  });
  const requestConfirmRef = useRef<HTMLButtonElement>(null);
  const cancelConfirmRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const requestStatus = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/me/time-machine", {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
    const payload = await readJson(response);
    if (!response.ok || !payload.state) throw new Error(payload.error || "목표 타임머신을 불러오지 못했어요.");
    return payload;
  }, []);

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    const payload = await requestStatus(signal);
    setStatus(payload);
    setMessage("");
    return payload;
  }, [requestStatus]);

  useEffect(() => {
    const controller = new AbortController();
    const request = initialRequest ?? requestStatus(controller.signal);
    void request
        .then((payload) => {
          if (controller.signal.aborted) return;
          setStatus(payload);
          setMessage("");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setMessage(error instanceof Error ? error.message : "목표 타임머신을 불러오지 못했어요.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    return () => {
      controller.abort();
    };
  }, [initialRequest, requestStatus]);

  useEffect(() => {
    if (!active || status?.state !== "locked") return;
    const timer = window.setInterval(() => {
      // Only re-check while the personal modal is open; the server remains the unlock authority.
      void loadStatus().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [active, loadStatus, status?.state]);

  useEffect(() => {
    if (confirming) confirmButtonRef.current?.focus();
  }, [confirming]);

  const closeConfirmation = () => {
    if (submitting) return;
    setConfirming(false);
    window.requestAnimationFrame(() => requestConfirmRef.current?.focus());
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
      confirmButtonRef.current?.focus();
    } else if (!event.shiftKey && document.activeElement === confirmButtonRef.current) {
      event.preventDefault();
      cancelConfirmRef.current?.focus();
    }
  };

  const requestConfirmation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = {
      goal_title: form.goal_title.trim(),
      goal_detail: form.goal_detail.trim(),
      commitment: form.commitment.trim(),
    };
    if (next.goal_title.length < 2) {
      setMessage("목표를 2자 이상 적어주세요.");
      return;
    }
    setForm(next);
    setMessage("");
    setConfirming(true);
  };

  const activate = async () => {
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/me/time-machine", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await readJson(response);
      if (!response.ok || !payload.state) throw new Error(payload.error || "타임머신을 발동하지 못했어요.");
      setStatus(payload);
      onStatusChange?.(payload);
      setConfirming(false);
      setForm({ goal_title: "", goal_detail: "", commitment: "" });
      setMessage("목표를 안전하게 보관했어요. 2027년 1월 1일에 열립니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "타임머신을 발동하지 못했어요.");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="h-72 animate-pulse rounded-[24px] bg-slate-100" aria-label="목표 타임머신을 불러오는 중" />;
  }

  if (!status) {
    return (
      <div className="rounded-[24px] bg-slate-50 p-5 text-center ring-1 ring-slate-950/5">
        <h3 className="text-lg font-black text-slate-950">타임머신을 불러오지 못했어요</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{message || "잠시 후 다시 확인해주세요."}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadStatus()
              .catch((error: unknown) => {
                setMessage(error instanceof Error ? error.message : "목표 타임머신을 불러오지 못했어요.");
              })
              .finally(() => setLoading(false));
          }}
          className="mt-4 min-h-12 w-full rounded-2xl bg-slate-900 px-4 text-sm font-black text-white"
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  const visualStyle = {
    "--time-machine-amplitude": `${(1 + status.progress * 5).toFixed(1)}px`,
    "--time-machine-duration": `${Math.max(1.65, 4.1 - status.progress * 2.2).toFixed(2)}s`,
  } as CSSProperties;

  if (status.state === "opened" && status.goal) {
    return (
      <section className="space-y-4" aria-labelledby="time-machine-title">
        <div>
          <p className="text-xs font-bold text-blue-600">100일 목표 타임머신</p>
          <h3 id="time-machine-title" className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">100일 전의 나에게서 온 기록</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">새해의 첫 순간, 내가 남긴 목표를 열어봤어요.</p>
        </div>
        <div className={styles.stage}>
          <div className={`${styles.capsule} ${styles.unlocked}`} style={visualStyle} aria-hidden="true"><span className={styles.lock}><ActivityIcon kind="fortune" /></span></div>
        </div>
        <div className="space-y-3 rounded-[24px] bg-blue-50 p-4 ring-1 ring-blue-100">
          <GoalText label="100일 목표" value={status.goal.title} strong />
          {status.goal.detail ? <GoalText label="세부 목표" value={status.goal.detail} /> : null}
          {status.goal.commitment ? <GoalText label="나의 다짐" value={status.goal.commitment} /> : null}
        </div>
      </section>
    );
  }

  if (status.state === "locked") {
    const days = remainingDays(status.unlock_at, status.server_now);
    return (
      <section className="space-y-4" aria-labelledby="time-machine-title">
        <div>
          <p className="text-xs font-bold text-blue-600">100일 목표 타임머신</p>
          <span id="time-machine-title" className="sr-only">타임머신</span>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">목표를 안전하게 보관 중이에요. 개봉 전에는 내용이 보이지 않아요.</p>
        </div>
        <div className={styles.stage}>
          <div className={styles.capsule} style={visualStyle} aria-hidden="true"><span className={styles.lock}><ActivityIcon kind="lock" /></span></div>
        </div>
        <div className="rounded-[22px] bg-slate-50 px-4 py-4 text-center ring-1 ring-slate-200">
          <p className="text-sm font-black text-slate-900">2027년 1월 1일 00:00에 열려요</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{days > 0 ? `${days}일 뒤 타임머신이 발동됩니다.` : "개봉 시간을 확인하고 있어요."}</p>
        </div>
        {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-700" role="status">{message}</p> : null}
      </section>
    );
  }

  return (
    <>
      <section className="space-y-5" aria-label="100일 목표 타임머신 작성">
        <form className="space-y-4" onSubmit={requestConfirmation} noValidate>
          <TextField label="2027년 1월 1일에 보고 싶은 나의 목표" value={form.goal_title} maxLength={MAX_TIME_MACHINE_GOAL_TITLE_LENGTH} placeholder="예: 10km를 편하게 완주하기" onChange={(value) => setForm((current) => ({ ...current, goal_title: value }))} />
          <TextField label="나의 다짐 쓰기 (선택)" value={form.commitment} maxLength={MAX_TIME_MACHINE_COMMITMENT_LENGTH} multiline placeholder="예: 힘든 날에도 10분만이라도 움직이기" onChange={(value) => setForm((current) => ({ ...current, commitment: value }))} />
          {message ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700" role="alert">{message}</p> : null}
          <button ref={requestConfirmRef} type="submit" className="min-h-14 w-full rounded-2xl bg-blue-600 px-5 text-base font-black text-white shadow-[0_8px_22px_rgba(49,130,246,0.2)] transition hover:bg-blue-700">타임머신 발동하기</button>
        </form>
      </section>

      {confirming ? (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="time-machine-confirm-title"
          onKeyDown={handleConfirmKeyDown}
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeConfirmation(); }}
        >
          <div className="w-full max-w-sm rounded-[26px] bg-white p-5 text-center shadow-2xl ring-1 ring-slate-950/5 sm:p-6">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-blue-50 text-2xl" aria-hidden="true"><ActivityIcon kind="time-machine" /></span>
            <h4 id="time-machine-confirm-title" className="mt-4 text-lg font-black leading-7 text-slate-950">2027년 1월 1일에 열립니다</h4>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">발동 뒤에는 개봉 전까지 목표 내용을 다시 볼 수 없어요.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button ref={cancelConfirmRef} type="button" disabled={submitting} onClick={closeConfirmation} className="min-h-12 rounded-2xl bg-slate-100 px-3 text-sm font-black text-slate-700 disabled:opacity-50">다시 보기</button>
              <button ref={confirmButtonRef} type="button" disabled={submitting} onClick={() => void activate()} className="min-h-12 rounded-2xl bg-blue-600 px-3 text-sm font-black text-white disabled:opacity-60">{submitting ? "발동 중…" : "확인"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TextField({ label, value, maxLength, placeholder, multiline = false, onChange }: { label: string; value: string; maxLength: number; placeholder: string; multiline?: boolean; onChange: (value: string) => void }) {
  const className = "mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100";
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-950">{label}</span>
      {multiline ? <textarea value={value} maxLength={maxLength} rows={3} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`${className} resize-y`} /> : <input value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={className} />}
      <span className="mt-1 block text-right text-[11px] font-bold text-slate-400">{value.length}/{maxLength}</span>
    </label>
  );
}

function GoalText({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="rounded-2xl bg-white/85 px-4 py-3"><p className="text-[11px] font-black text-slate-500">{label}</p><p className={`mt-1 whitespace-pre-wrap leading-6 text-slate-800 ${strong ? "text-base font-black" : "text-sm font-semibold"}`}>{value}</p></div>;
}
