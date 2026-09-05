"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CORRECTIVE_APPLICATION_STATUS_LABELS,
  CORRECTIVE_EXERCISE_PAIN_AREAS,
  CORRECTIVE_HOSPITAL_STATUS_LABELS,
  CORRECTIVE_PAIN_AREA_LABELS,
  MAX_CORRECTIVE_ADDITIONAL_NOTE_LENGTH,
  MAX_CORRECTIVE_HOSPITAL_NOTE_LENGTH,
  MAX_CORRECTIVE_PAIN_AREAS,
  MAX_CORRECTIVE_PAIN_CONTEXT_LENGTH,
  type CorrectiveExerciseApplication,
  type CorrectiveExerciseHospitalStatus,
  type CorrectiveExercisePainArea,
  type CorrectiveExerciseSlot,
} from "@/lib/corrective-exercise-contract";

type CorrectiveExerciseResponse = {
  slots: CorrectiveExerciseSlot[];
  application: CorrectiveExerciseApplication | null;
  participant_name: string;
  accepting_applications: boolean;
};

type CalendarMonth = {
  key: string;
  label: string;
  leadingDays: number;
  daysInMonth: number;
  year: number;
  month: number;
  availableDates: Set<string>;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const CANCELLABLE_STATUSES = new Set<CorrectiveExerciseApplication["status"]>([
  "submitted",
  "reviewing",
  "schedule_proposed",
]);

const ACTIVE_STATUSES = new Set<CorrectiveExerciseApplication["status"]>([
  "submitted",
  "reviewing",
  "schedule_proposed",
  "confirmed",
]);

function safeJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

function getErrorMessage(payload: Record<string, unknown>, fallback: string) {
  return typeof payload.error === "string" && payload.error.trim() ? payload.error : fallback;
}

function formatSlotDate(value: string) {
  const date = new Date(`${value}T12:00:00+09:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

function formatConfirmedFor(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

function slotTimeLabel(slot: CorrectiveExerciseSlot) {
  const start = formatTime(slot.start_time);
  const end = formatTime(slot.end_time);
  return end ? `${start}–${end}` : start;
}

function ApplicationSummary({
  application,
  onStartAgain,
  onCancelled,
}: {
  application: CorrectiveExerciseApplication;
  onStartAgain: () => void;
  onCancelled: (application: CorrectiveExerciseApplication) => void;
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState("");
  const isActive = ACTIVE_STATUSES.has(application.status);
  const canCancel = CANCELLABLE_STATUSES.has(application.status);
  const scheduleLabel = application.status === "schedule_proposed"
    ? "운영자가 제안한 일정"
    : application.status === "confirmed"
      ? "확정 일정"
      : application.status === "completed"
        ? "진행 일정"
        : null;

  const cancelApplication = async () => {
    setCancelling(true);
    setMessage("");
    try {
      const response = await fetch("/api/me/corrective-exercise", {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", id: application.id }),
      });
      const payload = await safeJson(response);
      if (!response.ok || !payload.application) {
        setMessage(getErrorMessage(payload, "신청을 취소하지 못했어요. 잠시 후 다시 시도해주세요."));
        return;
      }
      onCancelled(payload.application as CorrectiveExerciseApplication);
      setConfirmingCancel(false);
    } catch {
      setMessage("신청을 취소하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] bg-blue-50 p-4 ring-1 ring-blue-100 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black text-blue-600">신청 상태</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">
              {CORRECTIVE_APPLICATION_STATUS_LABELS[application.status]}
            </h3>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-xl shadow-sm" aria-hidden="true">
            {application.status === "confirmed" ? "📅" : application.status === "completed" ? "🙌" : isActive ? "📝" : "↩️"}
          </span>
        </div>

        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex items-start justify-between gap-4 rounded-2xl bg-white/80 px-3.5 py-3">
            <dt className="shrink-0 font-bold text-slate-500">희망 일정</dt>
            <dd className="text-right font-black text-slate-900">
              {formatSlotDate(application.requested_date)} {formatTime(application.requested_start_time)}
            </dd>
          </div>
          {application.confirmed_for && scheduleLabel ? (
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-blue-600 px-3.5 py-3 text-white">
              <dt className="shrink-0 font-bold text-blue-100">{scheduleLabel}</dt>
              <dd className="text-right font-black">{formatConfirmedFor(application.confirmed_for)}</dd>
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-4 rounded-2xl bg-white/80 px-3.5 py-3">
            <dt className="shrink-0 font-bold text-slate-500">통증 부위</dt>
            <dd className="text-right font-black text-slate-900">
              {application.pain_areas.map((area) => CORRECTIVE_PAIN_AREA_LABELS[area]).join(", ")}
            </dd>
          </div>
        </dl>

        {application.admin_note ? (
          <div className="mt-3 rounded-2xl bg-white px-3.5 py-3">
            <p className="text-[11px] font-black text-blue-600">운영자 안내</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-bold leading-6 text-slate-700">{application.admin_note}</p>
          </div>
        ) : isActive ? (
          <p className="mt-3 text-xs font-bold leading-5 text-slate-600">
            운영자가 내용을 확인한 뒤 일정 조율 안내를 남겨드려요.
          </p>
        ) : null}
      </div>

      {message ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold leading-5 text-rose-700" role="status">{message}</p> : null}

      {canCancel ? (
        confirmingCancel ? (
          <div className="rounded-[22px] bg-slate-100 p-4">
            <p className="text-sm font-black text-slate-900">이 신청을 취소할까요?</p>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">취소 후에는 가능한 날짜를 다시 골라 신청할 수 있어요.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmingCancel(false)} disabled={cancelling} className="min-h-12 rounded-2xl bg-white text-sm font-black text-slate-700 disabled:opacity-50">유지하기</button>
              <button type="button" onClick={() => void cancelApplication()} disabled={cancelling} className="min-h-12 rounded-2xl bg-slate-900 text-sm font-black text-white disabled:opacity-50">
                {cancelling ? "취소 중…" : "신청 취소"}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingCancel(true)} className="min-h-12 w-full rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-600">
            신청 취소하기
          </button>
        )
      ) : !isActive ? (
        <button type="button" onClick={onStartAgain} className="min-h-12 w-full rounded-2xl bg-blue-600 px-4 text-sm font-black text-white">
          가능한 날짜 다시 보기
        </button>
      ) : (
        <p className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-xs font-bold leading-5 text-slate-600">
          확정 일정 변경이 필요하면 운영자에게 문의해주세요.
        </p>
      )}
    </div>
  );
}

export function CorrectiveExerciseApplication() {
  const [data, setData] = useState<CorrectiveExerciseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [painAreas, setPainAreas] = useState<CorrectiveExercisePainArea[]>([]);
  const [painContext, setPainContext] = useState("");
  const [hospitalStatus, setHospitalStatus] = useState<CorrectiveExerciseHospitalStatus | "">("");
  const [hospitalNote, setHospitalNote] = useState("");
  const [additionalNote, setAdditionalNote] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/me/corrective-exercise", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => ({ response, payload: await safeJson(response) }))
      .then(({ response, payload }) => {
        if (!response.ok) {
          setError(getErrorMessage(payload, response.status === 503
            ? "신청 일정을 준비하고 있어요. 잠시 후 다시 확인해주세요."
            : "교정운동 신청 정보를 불러오지 못했어요."));
          return;
        }
        setData(payload as unknown as CorrectiveExerciseResponse);
        setError("");
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError("교정운동 신청 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retryKey]);

  const availableSlots = useMemo(
    () => (data?.slots ?? []).filter((slot) => slot.active && slot.remaining_capacity > 0),
    [data?.slots],
  );
  const calendarMonths = useMemo<CalendarMonth[]>(() => {
    const monthDates = new Map<string, Set<string>>();
    availableSlots.forEach((slot) => {
      const key = slot.slot_date.slice(0, 7);
      const dates = monthDates.get(key) ?? new Set<string>();
      dates.add(slot.slot_date);
      monthDates.set(key, dates);
    });
    return [...monthDates.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, availableDates]) => {
        const [year, month] = key.split("-").map(Number);
        return {
          key,
          label: `${year}년 ${month}월`,
          leadingDays: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
          daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
          year,
          month,
          availableDates,
        };
      });
  }, [availableSlots]);
  const selectedDaySlots = useMemo(
    () => availableSlots.filter((slot) => slot.slot_date === selectedDate),
    [availableSlots, selectedDate],
  );

  const togglePainArea = (area: CorrectiveExercisePainArea) => {
    setPainAreas((current) => {
      if (current.includes(area)) return current.filter((item) => item !== area);
      if (current.length >= MAX_CORRECTIVE_PAIN_AREAS) return current;
      return [...current, area];
    });
  };

  const startNewApplication = () => {
    setError("");
    setSuccessMessage("");
    setSelectedDate("");
    setSelectedSlotId("");
    setPainAreas([]);
    setPainContext("");
    setHospitalStatus("");
    setHospitalNote("");
    setAdditionalNote("");
    // 민감정보 동의는 신청마다 다시 받으며 이전 선택을 재사용하지 않습니다.
    setConsent(false);
    setShowNewForm(true);
  };

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!selectedSlotId) {
      setError("희망 날짜와 시간을 선택해주세요.");
      return;
    }
    if (painAreas.length === 0) {
      setError("통증이 있는 부위를 하나 이상 선택해주세요.");
      return;
    }
    if (painContext.trim().length < 10) {
      setError("통증이 생기는 상황을 10자 이상 적어주세요.");
      return;
    }
    if (!hospitalStatus) {
      setError("병원 이용 여부를 선택해주세요.");
      return;
    }
    if (!consent) {
      setError("민감정보 수집·이용에 동의해야 신청할 수 있어요.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/me/corrective-exercise", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_id: selectedSlotId,
          pain_areas: painAreas,
          pain_context: painContext,
          hospital_status: hospitalStatus,
          hospital_note: hospitalNote,
          additional_note: additionalNote,
          consent: true,
        }),
      });
      const payload = await safeJson(response);
      if (!response.ok || !payload.application) {
        setError(getErrorMessage(payload, "신청을 접수하지 못했어요. 내용을 확인하고 다시 시도해주세요."));
        return;
      }
      const application = payload.application as CorrectiveExerciseApplication;
      setData((current) => current ? { ...current, application } : current);
      setShowNewForm(false);
      setSuccessMessage("교정운동 신청을 접수했어요.");
    } catch {
      setError("신청을 접수하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-label="교정운동 신청 정보를 불러오는 중">
        <div className="h-28 animate-pulse rounded-[24px] bg-slate-100" />
        <div className="h-48 animate-pulse rounded-[24px] bg-slate-100" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[24px] bg-slate-50 p-5 text-center ring-1 ring-slate-950/5">
        <span className="text-4xl" aria-hidden="true">🗓️</span>
        <h3 className="mt-3 text-lg font-black text-slate-950">일정을 불러오지 못했어요</h3>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{error || "잠시 후 다시 확인해주세요."}</p>
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

  if (data.application && !showNewForm) {
    return (
      <div>
        {successMessage ? <p className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700" role="status">{successMessage}</p> : null}
        <ApplicationSummary
          application={data.application}
          onStartAgain={startNewApplication}
          onCancelled={(application) => {
            setData((current) => current ? { ...current, application } : current);
            setSuccessMessage("신청을 취소했어요.");
            setLoading(true);
            setRetryKey((current) => current + 1);
          }}
        />
      </div>
    );
  }

  if (!data.accepting_applications) {
    return (
      <div className="rounded-[24px] bg-slate-50 p-5 text-center ring-1 ring-slate-950/5">
        <span className="text-4xl" aria-hidden="true">🗓️</span>
        <h3 className="mt-3 text-lg font-black text-slate-950">교정운동 신청을 준비하고 있어요</h3>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
          일정, 개인정보 보호와 자동 파기 설정을 모두 확인한 뒤 신청을 열어드릴게요.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={(event) => void submitApplication(event)} noValidate>
      <div className="rounded-[24px] bg-gradient-to-br from-blue-600 to-cyan-500 p-5 text-white">
        <p className="text-[11px] font-black text-white/75">CORRECTIVE MOVEMENT</p>
        <h3 className="mt-1 text-xl font-black">{data.participant_name}님의 움직임 상담</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-white/90">
          가능한 일정을 고르고 통증이 생기는 상황을 알려주세요. 운영자가 확인 후 일정을 조율해요.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-black text-slate-950">1. 가능한 날짜 선택 <span className="text-blue-600">*</span></legend>
        {calendarMonths.length ? (
          <div className="mt-3 space-y-3">
            {calendarMonths.map((calendarMonth) => (
              <div key={calendarMonth.key} className="rounded-[22px] bg-slate-50 p-3 ring-1 ring-slate-200 sm:p-4">
                <p className="text-center text-sm font-black text-slate-900">{calendarMonth.label}</p>
                <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <span key={label} className={`pb-1 text-[10px] font-black ${index === 0 ? "text-rose-400" : index === 6 ? "text-blue-500" : "text-slate-400"}`}>{label}</span>
                  ))}
                  {Array.from({ length: calendarMonth.leadingDays }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
                  {Array.from({ length: calendarMonth.daysInMonth }, (_, index) => {
                    const day = index + 1;
                    const date = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const available = calendarMonth.availableDates.has(date);
                    const selected = selectedDate === date;
                    if (!available) {
                      return <span key={date} className="grid min-h-11 place-items-center rounded-xl text-xs font-bold text-slate-300" aria-hidden="true">{day}</span>;
                    }
                    return (
                      <button
                        key={date}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${formatSlotDate(date)} 선택`}
                        onClick={() => {
                          setSelectedDate(date);
                          setSelectedSlotId("");
                        }}
                        className={`grid min-h-11 place-items-center rounded-xl text-xs font-black ring-1 transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-blue-400 ${selected ? "bg-blue-600 text-white ring-blue-600 shadow-sm" : "bg-white text-blue-700 ring-blue-100 hover:bg-blue-50"}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {selectedDate ? (
              <div className="rounded-[22px] bg-blue-50 p-3.5 ring-1 ring-blue-100">
                <p className="text-xs font-black text-blue-800">{formatSlotDate(selectedDate)} 가능한 시간</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {selectedDaySlots.map((slot) => {
                    const checked = selectedSlotId === slot.id;
                    return (
                      <label key={slot.id} className={`cursor-pointer rounded-[17px] p-3 ring-1 transition focus-within:outline focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-blue-400 ${checked ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-slate-800 ring-blue-100 hover:bg-blue-100"}`}>
                        <input
                          type="radio"
                          name="corrective-slot"
                          value={slot.id}
                          checked={checked}
                          onChange={() => setSelectedSlotId(slot.id)}
                          className="sr-only"
                        />
                        <span className="block text-sm font-black">{slotTimeLabel(slot)}</span>
                        <span className={`mt-0.5 block text-[11px] font-bold ${checked ? "text-white/80" : "text-slate-500"}`}>{slot.remaining_capacity}자리 남음</span>
                        {slot.note ? <span className={`mt-1 block text-[11px] font-bold leading-4 ${checked ? "text-white/75" : "text-slate-500"}`}>{slot.note}</span> : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="px-1 text-xs font-bold text-slate-500">파란 날짜를 누르면 가능한 시간이 보여요.</p>
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-[20px] bg-slate-100 px-4 py-4 text-sm font-bold leading-6 text-slate-600">
            지금은 신청 가능한 일정이 없어요. 운영자가 일정을 열면 이곳에 바로 표시됩니다.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-black text-slate-950">2. 통증 부위 <span className="text-blue-600">*</span></legend>
        <p className="mt-1 text-xs font-bold text-slate-500">여러 곳을 고를 수 있어요. 최대 {MAX_CORRECTIVE_PAIN_AREAS}개</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CORRECTIVE_EXERCISE_PAIN_AREAS.map((area) => {
            const checked = painAreas.includes(area);
            const limitReached = painAreas.length >= MAX_CORRECTIVE_PAIN_AREAS && !checked;
            return (
              <label key={area} className={`cursor-pointer rounded-full px-3.5 py-2.5 text-xs font-black ring-1 transition focus-within:outline focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-blue-400 ${checked ? "bg-blue-600 text-white ring-blue-600" : limitReached ? "cursor-not-allowed bg-slate-100 text-slate-300 ring-slate-100" : "bg-white text-slate-700 ring-slate-200 hover:bg-blue-50"}`}>
                <input
                  type="checkbox"
                  value={area}
                  checked={checked}
                  disabled={limitReached}
                  onChange={() => togglePainArea(area)}
                  className="sr-only"
                />
                {checked ? "✓ " : ""}{CORRECTIVE_PAIN_AREA_LABELS[area]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-black text-slate-950">3. 언제, 어떤 동작에서 아픈가요? <span className="text-blue-600">*</span></span>
        <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">운동 종류, 동작, 통증이 시작되는 시점을 구체적으로 적어주세요.</span>
        <textarea
          value={painContext}
          onChange={(event) => setPainContext(event.target.value.slice(0, MAX_CORRECTIVE_PAIN_CONTEXT_LENGTH))}
          maxLength={MAX_CORRECTIVE_PAIN_CONTEXT_LENGTH}
          minLength={10}
          required
          rows={4}
          placeholder="예: 달리기 3km 이후 오른쪽 무릎 바깥쪽이 당기고, 계단을 내려갈 때 더 아파요."
          className="mt-2 w-full resize-y rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
        <span className="mt-1 block text-right text-[11px] font-bold text-slate-400">{painContext.length}/{MAX_CORRECTIVE_PAIN_CONTEXT_LENGTH}</span>
      </label>

      <fieldset>
        <legend className="text-sm font-black text-slate-950">4. 병원 이용 여부 <span className="text-blue-600">*</span></legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(Object.entries(CORRECTIVE_HOSPITAL_STATUS_LABELS) as [CorrectiveExerciseHospitalStatus, string][]).map(([status, label]) => {
            const checked = hospitalStatus === status;
            return (
              <label key={status} className={`cursor-pointer rounded-[18px] px-3 py-3 text-center text-xs font-black ring-1 transition focus-within:outline focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-blue-400 ${checked ? "bg-slate-900 text-white ring-slate-900" : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100"}`}>
                <input type="radio" name="hospital-status" value={status} checked={checked} onChange={() => setHospitalStatus(status)} className="sr-only" />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {hospitalStatus === "past" || hospitalStatus === "current" ? (
        <label className="block">
          <span className="text-sm font-black text-slate-950">병원 이용 내용 <span className="font-bold text-slate-400">선택</span></span>
          <textarea
            value={hospitalNote}
            onChange={(event) => setHospitalNote(event.target.value.slice(0, MAX_CORRECTIVE_HOSPITAL_NOTE_LENGTH))}
            maxLength={MAX_CORRECTIVE_HOSPITAL_NOTE_LENGTH}
            rows={3}
            placeholder="진료 시기와 현재 안내받은 주의사항이 있다면 적어주세요."
            className="mt-2 w-full resize-y rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
          <span className="mt-1 block text-right text-[11px] font-bold text-slate-400">{hospitalNote.length}/{MAX_CORRECTIVE_HOSPITAL_NOTE_LENGTH}</span>
        </label>
      ) : null}

      <label className="block">
        <span className="text-sm font-black text-slate-950">운영자에게 전할 내용 <span className="font-bold text-slate-400">선택</span></span>
        <textarea
          value={additionalNote}
          onChange={(event) => setAdditionalNote(event.target.value.slice(0, MAX_CORRECTIVE_ADDITIONAL_NOTE_LENGTH))}
          maxLength={MAX_CORRECTIVE_ADDITIONAL_NOTE_LENGTH}
          rows={3}
          placeholder="일정 조율이나 운동 시 참고할 내용을 적어주세요."
          className="mt-2 w-full resize-y rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
        <span className="mt-1 block text-right text-[11px] font-bold text-slate-400">{additionalNote.length}/{MAX_CORRECTIVE_ADDITIONAL_NOTE_LENGTH}</span>
      </label>

      <div className="rounded-[22px] bg-amber-50 p-4 ring-1 ring-amber-100">
        <p className="text-xs font-black text-amber-900">의료 서비스가 아니에요</p>
        <p className="mt-1 text-xs font-bold leading-5 text-amber-800/80">
          이 신청은 의료진의 진단이나 치료를 대신하지 않습니다. 갑작스럽거나 심한 통증, 마비, 흉통, 호흡곤란 등 응급 증상이 있다면 119 또는 의료기관을 이용해주세요.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[22px] bg-slate-100 p-4">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
          className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600"
        />
        <span className="min-w-0 text-xs font-bold leading-5 text-slate-700">
          <strong className="text-slate-950">민감정보 수집·이용 동의 (필수)</strong>
          <span className="mt-2 grid gap-1">
            <span><b className="text-slate-900">수집 항목</b> · 크루 식별 정보, 희망 일정, 통증 부위·발생 상황, 병원 이용 상태, 선택 메모</span>
            <span><b className="text-slate-900">이용 목적</b> · 교정운동 상담과 일정 조율</span>
            <span><b className="text-slate-900">보유 기간</b> · 접수일부터 최대 180일, 완료·취소·거절 후 90일 이내 파기</span>
          </span>
          <span className="mt-2 block text-slate-500">더 이른 삭제를 요청할 수 있으며, 동의를 거부하면 신청할 수 없어요.</span>
          <a
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-10 items-center font-black text-blue-700 underline underline-offset-4"
          >
            개인정보처리방침 확인
          </a>
        </span>
      </label>

      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700" role="alert">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting || availableSlots.length === 0}
        className="min-h-14 w-full rounded-[20px] bg-blue-600 px-5 text-base font-black text-white shadow-lg shadow-blue-500/15 transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
      >
        {submitting ? "신청하는 중…" : availableSlots.length ? "교정운동 신청하기" : "신청 가능한 일정 없음"}
      </button>
    </form>
  );
}
