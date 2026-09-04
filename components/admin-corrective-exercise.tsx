"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IconCalendar, IconCheck, IconSync } from "@/components/icons";
import {
  CORRECTIVE_APPLICATION_STATUS_LABELS,
  CORRECTIVE_HOSPITAL_STATUS_LABELS,
  CORRECTIVE_PAIN_AREA_LABELS,
  MAX_CORRECTIVE_ADMIN_NOTE_LENGTH,
  MAX_CORRECTIVE_SLOT_CAPACITY,
  type CorrectiveExerciseApplication as CorrectiveApplication,
  type CorrectiveExerciseApplicationSummary as CorrectiveApplicationSummary,
  type CorrectiveExerciseApplicationStatus as ApplicationStatus,
  type CorrectiveExerciseHospitalStatus as HospitalStatus,
  type CorrectiveExerciseSlot as CorrectiveSlot,
} from "@/lib/corrective-exercise-contract";
import { FOURTH_SEASON_END_DATE, FOURTH_SEASON_START_DATE } from "@/lib/fourth-season-contract";

type ApiPayload = {
  error?: string;
  setup_required?: boolean;
  deleted_id?: string;
  applications?: CorrectiveApplicationSummary[];
  application?: CorrectiveApplication;
  slots?: CorrectiveSlot[];
};

type Feedback = {
  tone: "success" | "error" | "info";
  message: string;
};

type SlotDraft = {
  slot_date: string;
  start_time: string;
  end_time: string;
  capacity: string;
};

type ApplicationStatusFilter = "all" | "attention" | ApplicationStatus;

const STATUS_OPTIONS: ReadonlyArray<{ value: ApplicationStatus; label: string }> = [
  { value: "submitted", label: "신청 완료" },
  { value: "reviewing", label: "운영자 확인 중" },
  { value: "schedule_proposed", label: "일정 조율 중" },
  { value: "confirmed", label: "일정 확정" },
  { value: "completed", label: "진행 완료" },
  { value: "cancelled", label: "신청 취소" },
  { value: "rejected", label: "진행 어려움" },
];

const STATUS_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  submitted: ["submitted", "reviewing", "schedule_proposed", "confirmed", "cancelled", "rejected"],
  reviewing: ["reviewing", "schedule_proposed", "confirmed", "cancelled", "rejected"],
  schedule_proposed: ["schedule_proposed", "reviewing", "confirmed", "cancelled", "rejected"],
  confirmed: ["confirmed", "completed", "cancelled"],
  completed: ["completed"],
  cancelled: ["cancelled"],
  rejected: ["rejected"],
};

const EMPTY_APPLICATION_DRAFT = {
  status: "submitted" as ApplicationStatus,
  confirmed_for: "",
  admin_note: "",
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Seoul",
});

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "미정";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return DATE_TIME_FORMATTER.format(parsed);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "미정";
  const normalized = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? `${value}T12:00:00+09:00` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return DATE_FORMATTER.format(parsed);
}

function formatTime(value: string | null | undefined) {
  if (!value) return "시간 협의";
  return value.slice(0, 5);
}

function statusMeta(status: ApplicationStatus) {
  if (status === "submitted") return { label: CORRECTIVE_APPLICATION_STATUS_LABELS[status], className: "bg-blue-50 text-blue-700 ring-blue-100" };
  if (status === "reviewing") return { label: CORRECTIVE_APPLICATION_STATUS_LABELS[status], className: "bg-cyan-50 text-cyan-800 ring-cyan-100" };
  if (status === "schedule_proposed") return { label: CORRECTIVE_APPLICATION_STATUS_LABELS[status], className: "bg-amber-50 text-amber-800 ring-amber-100" };
  if (status === "confirmed") return { label: "일정 확정", className: "bg-violet-50 text-violet-700 ring-violet-100" };
  if (status === "completed") return { label: "진행 완료", className: "bg-lime-50 text-lime-800 ring-lime-100" };
  if (status === "rejected") return { label: "진행 어려움", className: "bg-rose-50 text-rose-700 ring-rose-100" };
  return { label: "신청 취소", className: "bg-slate-100 text-slate-600 ring-slate-200" };
}

function hospitalLabel(status: HospitalStatus) {
  return CORRECTIVE_HOSPITAL_STATUS_LABELS[status];
}

function participantName(application: Pick<CorrectiveApplication, "participant_name">) {
  return application.participant_name || "이름 확인 필요";
}

function painAreas(application: CorrectiveApplication) {
  return application.pain_areas.map((area) => CORRECTIVE_PAIN_AREA_LABELS[area]);
}

function applicationSlot(application: Pick<CorrectiveApplicationSummary, "requested_slot_id">, slots: CorrectiveSlot[]) {
  return slots.find((slot) => slot.id === application.requested_slot_id) || null;
}

function slotLabel(slot: CorrectiveSlot | null, fallbackDate?: string | null) {
  if (!slot) return fallbackDate ? `${formatDate(fallbackDate)} · 시간 협의` : "희망 일정 없음";
  const endTime = slot.end_time ? `–${formatTime(slot.end_time)}` : "";
  return `${formatDate(slot.slot_date)} · ${formatTime(slot.start_time)}${endTime}`;
}

function applicationScheduleLabel(application: Pick<CorrectiveApplicationSummary, "requested_slot_id" | "requested_date" | "requested_start_time" | "requested_end_time">, slots: CorrectiveSlot[]) {
  const slot = applicationSlot(application, slots);
  if (slot) return slotLabel(slot);
  const endTime = application.requested_end_time ? `–${formatTime(application.requested_end_time)}` : "";
  return `${formatDate(application.requested_date)} · ${formatTime(application.requested_start_time)}${endTime}`;
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 16);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Seoul",
  }).formatToParts(parsed);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function toKstIsoString(value: string) {
  const parsed = new Date(`${value}:00+09:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function todayInKorea() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date());
}

function initialSlotDate() {
  const today = todayInKorea();
  if (today < FOURTH_SEASON_START_DATE) return FOURTH_SEASON_START_DATE;
  if (today > FOURTH_SEASON_END_DATE) return FOURTH_SEASON_END_DATE;
  return today;
}

async function apiRequest(method: "GET" | "POST" | "PATCH" | "DELETE", body?: object, options?: { applicationId?: string; signal?: AbortSignal }) {
  const query = options?.applicationId ? `?id=${encodeURIComponent(options.applicationId)}` : "";
  const response = await fetch(`/api/admin/hello-2027/corrective-exercise${query}`, {
    method,
    cache: "no-store",
    signal: options?.signal,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({})) as ApiPayload;
  if (!response.ok) throw Object.assign(new Error(json.error || "요청을 처리하지 못했어요."), { setupRequired: json.setup_required });
  return json;
}

function Notice({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;
  const className = feedback.tone === "error"
    ? "bg-rose-50 text-rose-800 ring-rose-200"
    : feedback.tone === "success"
      ? "bg-lime-50 text-lime-900 ring-lime-200"
      : "bg-blue-50 text-blue-800 ring-blue-200";
  return <p className={`rounded-2xl px-4 py-3 text-xs font-bold leading-5 ring-1 ${className}`} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.message}</p>;
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-oriwan-surface-light px-4 py-3">
      <dt className="text-[10px] font-black uppercase tracking-[0.08em] text-oriwan-text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-oriwan-text">{children || "응답 없음"}</dd>
    </div>
  );
}

export function AdminCorrectiveExercise() {
  const selectedIdRef = useRef("");
  const detailRequestRef = useRef<AbortController | null>(null);
  const listRequestRef = useRef<AbortController | null>(null);
  const [applications, setApplications] = useState<CorrectiveApplicationSummary[]>([]);
  const [slots, setSlots] = useState<CorrectiveSlot[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<CorrectiveApplication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [deleteArmedId, setDeleteArmedId] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [applicationDraft, setApplicationDraft] = useState(EMPTY_APPLICATION_DRAFT);
  const [slotDraft, setSlotDraft] = useState<SlotDraft>({
    slot_date: initialSlotDate(),
    start_time: "10:00",
    end_time: "11:00",
    capacity: "1",
  });
  const [slotCapacityDrafts, setSlotCapacityDrafts] = useState<Record<string, string>>({});

  const clearSensitiveDetail = useCallback(() => {
    detailRequestRef.current?.abort();
    detailRequestRef.current = null;
    setSelectedApplication(null);
    setDetailLoading(false);
    setDetailError("");
    setApplicationDraft(EMPTY_APPLICATION_DRAFT);
    setDeleteArmedId("");
  }, []);

  const loadApplicationDetail = useCallback(async (id: string) => {
    detailRequestRef.current?.abort();
    const controller = new AbortController();
    detailRequestRef.current = controller;
    setSelectedApplication(null);
    setDetailError("");
    setDetailLoading(true);
    setApplicationDraft(EMPTY_APPLICATION_DRAFT);

    try {
      const json = await apiRequest("GET", undefined, { applicationId: id, signal: controller.signal });
      const application = json.application;
      if (!application || application.id !== id) throw new Error("선택한 신청 상세를 확인하지 못했어요.");
      if (controller.signal.aborted || selectedIdRef.current !== id) return;
      setSelectedApplication(application);
      setApplicationDraft({
        status: application.status,
        confirmed_for: toDateTimeLocalValue(application.confirmed_for),
        admin_note: application.admin_note || "",
      });
    } catch (error) {
      if (controller.signal.aborted || selectedIdRef.current !== id) return;
      setDetailError(error instanceof Error ? error.message : "선택한 신청 상세를 불러오지 못했어요.");
    } finally {
      if (detailRequestRef.current === controller) detailRequestRef.current = null;
      if (!controller.signal.aborted && selectedIdRef.current === id) setDetailLoading(false);
    }
  }, []);

  const load = useCallback(async (quiet = false) => {
    listRequestRef.current?.abort();
    const controller = new AbortController();
    listRequestRef.current = controller;
    const hadSelection = Boolean(selectedIdRef.current);
    clearSensitiveDetail();
    if (hadSelection) setDetailLoading(true);
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setFeedback(null);
    try {
      const json = await apiRequest("GET", undefined, { signal: controller.signal });
      if (controller.signal.aborted) return false;
      const nextApplications = Array.isArray(json.applications) ? json.applications : [];
      const nextSlots = Array.isArray(json.slots) ? json.slots : [];
      setApplications(nextApplications);
      setSlots(nextSlots);
      setSlotCapacityDrafts(Object.fromEntries(nextSlots.map((slot) => [slot.id, String(slot.capacity)])));
      const currentSelectedId = selectedIdRef.current;
      const nextSelectedId = currentSelectedId && nextApplications.some((item) => item.id === currentSelectedId)
        ? currentSelectedId
        : "";
      selectedIdRef.current = nextSelectedId;
      setSelectedId(nextSelectedId);
      setSetupRequired(false);
      if (nextSelectedId) await loadApplicationDetail(nextSelectedId);
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      setApplications([]);
      setSlots([]);
      selectedIdRef.current = "";
      setSelectedId("");
      clearSensitiveDetail();
      const setup = Boolean(error && typeof error === "object" && "setupRequired" in error && error.setupRequired);
      setSetupRequired(setup);
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "교정운동 신청을 불러오지 못했어요.",
      });
      return false;
    } finally {
      if (listRequestRef.current === controller) listRequestRef.current = null;
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [clearSensitiveDetail, loadApplicationDetail]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
    return () => {
      listRequestRef.current?.abort();
      detailRequestRef.current?.abort();
    };
  }, [load]);

  const filteredApplications = useMemo(() => applications.filter((application) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "attention") {
      return application.status === "submitted" || application.status === "reviewing" || application.status === "schedule_proposed";
    }
    return application.status === statusFilter;
  }), [applications, statusFilter]);

  const summary = useMemo(() => ({
    all: applications.length,
    waiting: applications.filter((item) => item.status === "submitted" || item.status === "reviewing" || item.status === "schedule_proposed").length,
    confirmed: applications.filter((item) => item.status === "confirmed").length,
    completed: applications.filter((item) => item.status === "completed").length,
  }), [applications]);

  const selectApplication = (id: string) => {
    selectedIdRef.current = id;
    setSelectedId(id);
    void loadApplicationDetail(id);
    if (window.matchMedia("(max-width: 1279px)").matches) {
      window.setTimeout(() => document.getElementById("corrective-application-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  };

  const changeStatusFilter = (nextFilter: ApplicationStatusFilter) => {
    setStatusFilter(nextFilter);
    const selectedStillVisible = applications.some((item) => {
      if (item.id !== selectedIdRef.current) return false;
      if (nextFilter === "all") return true;
      if (nextFilter === "attention") return item.status === "submitted" || item.status === "reviewing" || item.status === "schedule_proposed";
      return item.status === nextFilter;
    });
    if (selectedStillVisible) return;
    selectedIdRef.current = "";
    setSelectedId("");
    clearSensitiveDetail();
  };

  const closeApplicationDetail = () => {
    selectedIdRef.current = "";
    setSelectedId("");
    clearSensitiveDetail();
  };

  const saveApplication = async () => {
    if (!selectedApplication) return;
    if ((applicationDraft.status === "schedule_proposed" || applicationDraft.status === "confirmed") && !applicationDraft.confirmed_for) {
      setFeedback({ tone: "error", message: "일정 조율 또는 확정 상태로 바꾸려면 약속 일시를 입력해주세요." });
      return;
    }
    setBusyKey(`application:${selectedApplication.id}`);
    setFeedback(null);
    try {
      await apiRequest("PATCH", {
        action: "update_application",
        id: selectedApplication.id,
        status: applicationDraft.status,
        confirmed_for: applicationDraft.confirmed_for ? toKstIsoString(applicationDraft.confirmed_for) : null,
        admin_note: applicationDraft.admin_note.trim(),
      });
      const refreshed = await load(true);
      if (refreshed) setFeedback({ tone: "success", message: `${participantName(selectedApplication)}님의 신청 상태를 저장했어요.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "신청 상태를 저장하지 못했어요." });
    } finally {
      setBusyKey("");
    }
  };

  const deleteApplication = async () => {
    if (!selectedApplication || deleteArmedId !== selectedApplication.id) return;
    const applicationId = selectedApplication.id;
    const name = participantName(selectedApplication);
    setBusyKey(`delete-application:${applicationId}`);
    setFeedback(null);
    try {
      await apiRequest("DELETE", {
        action: "delete_application",
        id: applicationId,
        expected_updated_at: selectedApplication.updated_at,
        confirm: true,
      });
      selectedIdRef.current = "";
      setSelectedId("");
      clearSensitiveDetail();
      const refreshed = await load(true);
      if (refreshed) setFeedback({ tone: "success", message: `${name}님의 신청과 건강 문진 내용을 삭제했어요.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "신청을 삭제하지 못했어요." });
    } finally {
      setBusyKey("");
    }
  };

  const createSlot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const capacity = Number(slotDraft.capacity);
    if (!slotDraft.slot_date || !slotDraft.start_time || !Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CORRECTIVE_SLOT_CAPACITY) {
      setFeedback({ tone: "error", message: `날짜·시작 시간과 1~${MAX_CORRECTIVE_SLOT_CAPACITY}명 사이의 정원을 확인해주세요.` });
      return;
    }
    if (slotDraft.end_time && slotDraft.end_time <= slotDraft.start_time) {
      setFeedback({ tone: "error", message: "종료 시간은 시작 시간보다 늦어야 해요." });
      return;
    }
    setBusyKey("new-slot");
    setFeedback(null);
    try {
      await apiRequest("POST", {
        action: "create_slot",
        slot_date: slotDraft.slot_date,
        start_time: slotDraft.start_time,
        end_time: slotDraft.end_time || null,
        capacity,
        active: true,
      });
      const refreshed = await load(true);
      if (refreshed) setFeedback({ tone: "success", message: `${formatDate(slotDraft.slot_date)} 가능 일정을 열었어요.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "가능 일정을 추가하지 못했어요." });
    } finally {
      setBusyKey("");
    }
  };

  const updateSlot = async (slot: CorrectiveSlot, patch: { active?: boolean; capacity?: number }) => {
    setBusyKey(`slot:${slot.id}`);
    setFeedback(null);
    try {
      await apiRequest("PATCH", {
        action: "update_slot",
        id: slot.id,
        ...patch,
      });
      const refreshed = await load(true);
      if (refreshed) {
        setFeedback({
          tone: "success",
          message: typeof patch.active === "boolean"
            ? patch.active ? "신청 가능한 일정으로 열었어요." : "이 일정의 새 신청을 닫았어요."
            : "일정 정원을 변경했어요.",
        });
      }
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "일정을 변경하지 못했어요." });
    } finally {
      setBusyKey("");
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="corrective-exercise-admin-title">
      <div className="card mobile-page-card overflow-hidden p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black tracking-[0.02em] text-blue-600">교정운동 운영</p>
            <h2 id="corrective-exercise-admin-title" className="mt-1 text-2xl font-black tracking-[-0.04em] text-oriwan-text sm:text-3xl">교정운동 신청</h2>
            <p className="mt-2 max-w-3xl break-keep text-sm font-semibold leading-6 text-oriwan-text-muted">
              신청자의 희망 일정과 사전 문진을 확인하고, 연락·확정·완료 흐름을 한곳에서 관리해요.
            </p>
          </div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing || loading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-oriwan-surface-light px-4 text-xs font-black text-oriwan-text transition hover:bg-slate-200 disabled:opacity-50 sm:w-fit">
            <IconSync size={15} className={refreshing ? "animate-spin" : ""} />
            새로고침
          </button>
        </div>

        <div className="mt-5 rounded-[22px] bg-rose-50 p-4 text-rose-950 ring-1 ring-rose-100 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rose-100 text-sm font-black text-rose-700" aria-hidden="true">!</span>
            <div>
              <p className="text-sm font-black">민감한 건강정보를 다루는 화면이에요</p>
              <p className="mt-1 break-keep text-xs font-semibold leading-5 text-rose-900/65">
                일정 조율에 필요한 내용만 열람하고 외부로 전달하지 마세요. 진단이나 치료 판단이 아닌 신청 접수용 문진이며, 응급 증상은 의료기관 안내가 우선입니다.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["전체", summary.all, "text-oriwan-text", "all"],
            ["확인 필요", summary.waiting, "text-blue-600", "attention"],
            ["일정 확정", summary.confirmed, "text-violet-600", "confirmed"],
            ["진행 완료", summary.completed, "text-lime-700", "completed"],
          ].map(([label, count, color, filter]) => (
            <button
              key={String(label)}
              type="button"
              aria-pressed={statusFilter === filter}
              onClick={() => changeStatusFilter(filter as ApplicationStatusFilter)}
              className={`rounded-[20px] px-4 py-3 text-left transition ${statusFilter === filter ? "bg-white shadow-sm ring-2 ring-blue-500" : "bg-oriwan-surface-light ring-1 ring-transparent hover:bg-white hover:ring-slate-200"}`}
            >
              <p className="text-[10px] font-black text-oriwan-text-muted">{label}</p>
              <p className={`mt-1 text-2xl font-black ${color}`}>{count}</p>
            </button>
          ))}
        </div>

        {feedback ? <div className="mt-4"><Notice feedback={feedback} /></div> : null}
        {setupRequired ? (
          <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-950 ring-1 ring-amber-200">
            Supabase SQL Editor에서 기본 교정운동 SQL 다음 <code className="font-black">docs/migrations/2026-09-04-corrective-exercise-audit-and-delete.sql</code>을 적용한 뒤 다시 불러와주세요.
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(20rem,0.86fr)_minmax(0,1.14fr)] xl:items-start">
        <section className="card mobile-page-card p-4 sm:p-5" aria-labelledby="corrective-application-list-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 id="corrective-application-list-title" className="text-lg font-black text-oriwan-text">신청 목록</h3>
              <p className="mt-1 text-xs font-semibold text-oriwan-text-muted">상세 문진은 신청을 선택했을 때만 보여요.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700">{filteredApplications.length}건</span>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto rounded-2xl bg-oriwan-surface-light p-1.5" role="group" aria-label="신청 상태 필터">
            {[{ value: "all" as const, label: "전체" }, { value: "attention" as const, label: "확인 필요" }, ...STATUS_OPTIONS].map((option) => (
              <button key={option.value} type="button" onClick={() => changeStatusFilter(option.value)} className={`min-h-10 shrink-0 rounded-xl px-3 text-[11px] font-black transition ${statusFilter === option.value ? "bg-white text-oriwan-text shadow-sm" : "text-oriwan-text-muted hover:text-oriwan-text"}`}>
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-2">
            {loading ? <p className="rounded-[20px] bg-oriwan-surface-light px-4 py-10 text-center text-xs font-bold text-oriwan-text-muted">신청을 안전하게 불러오는 중…</p> : null}
            {!loading && !filteredApplications.length ? <p className="rounded-[20px] bg-oriwan-surface-light px-4 py-10 text-center text-xs font-bold leading-5 text-oriwan-text-muted">이 상태의 신청이 없습니다.</p> : null}
            {filteredApplications.map((application) => {
              const meta = statusMeta(application.status);
              return (
                <button key={application.id} type="button" onClick={() => selectApplication(application.id)} aria-pressed={selectedId === application.id} className={`w-full rounded-[20px] p-4 text-left transition ${selectedId === application.id ? "bg-blue-50 ring-2 ring-blue-500" : "bg-oriwan-surface-light ring-1 ring-transparent hover:bg-white hover:ring-slate-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-oriwan-text">{participantName(application)}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-oriwan-text-muted"><IconCalendar size={13} /> {applicationScheduleLabel(application, slots)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${meta.className}`}>{meta.label}</span>
                  </div>
                  <p className="mt-3 text-[10px] font-bold text-oriwan-text-muted">접수 {formatTimestamp(application.created_at)}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section id="corrective-application-detail" className="card mobile-page-card scroll-mt-40 p-4 sm:scroll-mt-32 sm:p-5" aria-label="교정운동 신청 상세">
          {selectedId && detailLoading ? (
            <div className="grid min-h-72 place-items-center rounded-[22px] bg-oriwan-surface-light px-6 text-center" role="status" aria-busy="true">
              <div>
                <span className="mx-auto block size-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" aria-hidden="true" />
                <p className="mt-4 text-base font-black text-oriwan-text">선택한 신청을 불러오는 중…</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-oriwan-text-muted">민감 문진 내용은 이 화면에만 잠시 표시합니다.</p>
              </div>
            </div>
          ) : selectedId && detailError ? (
            <div className="grid min-h-72 place-items-center rounded-[22px] bg-rose-50 px-6 text-center" role="alert">
              <div>
                <p className="text-base font-black text-rose-900">신청 상세를 불러오지 못했어요</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-rose-700">{detailError}</p>
                <button type="button" onClick={() => void loadApplicationDetail(selectedId)} className="mt-4 min-h-11 rounded-xl bg-white px-4 text-xs font-black text-rose-700 shadow-sm ring-1 ring-rose-200">
                  다시 불러오기
                </button>
              </div>
            </div>
          ) : selectedApplication ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-black tracking-[0.02em] text-blue-600">신청 상세</p>
                  <h3 id="corrective-application-detail-title" className="mt-1 text-xl font-black text-oriwan-text">{participantName(selectedApplication)}님의 신청</h3>
                  <p className="mt-1 text-xs font-semibold text-oriwan-text-muted">접수 {formatTimestamp(selectedApplication.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-fit shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black ring-1 ${statusMeta(selectedApplication.status).className}`}>{statusMeta(selectedApplication.status).label}</span>
                  <button type="button" onClick={closeApplicationDetail} className="min-h-9 rounded-xl bg-oriwan-surface-light px-3 text-[11px] font-black text-oriwan-text-muted transition hover:bg-slate-200 hover:text-oriwan-text">상세 닫기</button>
                </div>
              </div>

              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                <DetailItem label="희망 일정">{applicationScheduleLabel(selectedApplication, slots)}</DetailItem>
                <DetailItem label="통증 부위">
                  {painAreas(selectedApplication).length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {painAreas(selectedApplication).map((area) => <span key={area} className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">{area}</span>)}
                    </span>
                  ) : "응답 없음"}
                </DetailItem>
                <DetailItem label="통증 발생 상황">{selectedApplication.pain_context}</DetailItem>
                <DetailItem label="병원 이용 여부">{hospitalLabel(selectedApplication.hospital_status)}</DetailItem>
                <DetailItem label="병원 관련 설명">{selectedApplication.hospital_note}</DetailItem>
                <DetailItem label="추가 전달사항">{selectedApplication.additional_note}</DetailItem>
                <DetailItem label="민감정보 수집 동의">{formatTimestamp(selectedApplication.consented_at)}</DetailItem>
                <DetailItem label="자동 삭제 예정">{formatTimestamp(selectedApplication.retention_until)}</DetailItem>
                <DetailItem label="현재 확정 일정">{formatTimestamp(selectedApplication.confirmed_for)}</DetailItem>
              </dl>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <h4 className="text-sm font-black text-oriwan-text">운영 처리</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-black text-oriwan-text-muted">
                    진행 상태
                    <select value={applicationDraft.status} onChange={(event) => setApplicationDraft((current) => ({ ...current, status: event.target.value as ApplicationStatus }))} className="mt-1.5 min-h-12 w-full rounded-xl border border-oriwan-border bg-white px-3 text-sm font-black text-oriwan-text outline-none focus:border-blue-500">
                      {STATUS_OPTIONS.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          disabled={!STATUS_TRANSITIONS[selectedApplication.status].includes(option.value)}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-black text-oriwan-text-muted">
                    확정 일시
                    <input type="datetime-local" value={applicationDraft.confirmed_for} onChange={(event) => setApplicationDraft((current) => ({ ...current, confirmed_for: event.target.value }))} className="mt-1.5 min-h-12 w-full rounded-xl border border-oriwan-border bg-white px-3 text-sm font-black text-oriwan-text outline-none focus:border-blue-500" />
                  </label>
                </div>
                <label className="mt-3 block text-xs font-black text-oriwan-text-muted">
                  신청자 안내 <span className="font-bold text-blue-600">(신청자 본인에게 공개)</span>
                  <textarea value={applicationDraft.admin_note} maxLength={MAX_CORRECTIVE_ADMIN_NOTE_LENGTH} rows={4} onChange={(event) => setApplicationDraft((current) => ({ ...current, admin_note: event.target.value }))} placeholder="신청자가 확인할 일정 안내를 적어주세요. 내부 메모나 판단은 기록하지 마세요." className="mt-1.5 w-full resize-y rounded-xl border border-oriwan-border bg-white px-3 py-3 text-sm font-semibold leading-6 text-oriwan-text outline-none focus:border-blue-500" />
                </label>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[10px] font-bold text-oriwan-text-muted">{applicationDraft.admin_note.length}/{MAX_CORRECTIVE_ADMIN_NOTE_LENGTH}</p>
                  <button type="button" onClick={() => void saveApplication()} disabled={busyKey === `application:${selectedApplication.id}`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto">
                    <IconCheck size={16} />
                    {busyKey === `application:${selectedApplication.id}` ? "저장 중…" : "처리 내용 저장"}
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-[20px] bg-rose-50 p-4 ring-1 ring-rose-100">
                <p className="text-xs font-black text-rose-900">삭제 요청 처리</p>
                <p className="mt-1 text-[11px] font-semibold leading-5 text-rose-700">
                  신청과 건강 문진 원문은 운영 DB에서 즉시 삭제되며 이 화면에서 되돌릴 수 없어요. 감사 로그에는 원문 없이 신청 ID·상태·처리자·시각만 남습니다.
                </p>
                {deleteArmedId === selectedApplication.id ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => setDeleteArmedId("")} disabled={busyKey === `delete-application:${selectedApplication.id}`} className="min-h-11 rounded-xl bg-white px-4 text-xs font-black text-rose-700 ring-1 ring-rose-200 disabled:opacity-50">
                      취소
                    </button>
                    <button type="button" onClick={() => void deleteApplication()} disabled={busyKey === `delete-application:${selectedApplication.id}`} className="min-h-11 rounded-xl bg-rose-600 px-4 text-xs font-black text-white transition hover:bg-rose-700 disabled:opacity-50">
                      {busyKey === `delete-application:${selectedApplication.id}` ? "삭제 중…" : "운영 DB에서 삭제"}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDeleteArmedId(selectedApplication.id)} className="mt-3 min-h-11 rounded-xl bg-white px-4 text-xs font-black text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100">
                    신청 삭제
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="grid min-h-72 place-items-center rounded-[22px] bg-oriwan-surface-light px-6 text-center">
              <div>
                <p className="text-base font-black text-oriwan-text">확인할 신청을 선택해주세요</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-oriwan-text-muted">민감 문진 내용은 선택한 신청 한 건만 표시합니다.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="card mobile-page-card p-4 sm:p-6" aria-labelledby="corrective-slot-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black tracking-[0.02em] text-blue-600">일정 관리</p>
            <h3 id="corrective-slot-title" className="mt-1 text-xl font-black text-oriwan-text">신청 가능한 일정</h3>
            <p className="mt-1 break-keep text-xs font-semibold leading-5 text-oriwan-text-muted">활성 일정만 개인 신청 달력에 표시됩니다. 기존 신청이 있는 일정은 닫아도 기록이 유지돼요.</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700">활성 {slots.filter((slot) => slot.active).length}개</span>
        </div>

        <form onSubmit={createSlot} className="mt-4 rounded-[22px] bg-oriwan-surface-light p-4">
          <p className="text-sm font-black text-oriwan-text">새 일정 열기</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_0.7fr_auto] lg:items-end">
            <label className="text-[11px] font-black text-oriwan-text-muted">날짜<input required type="date" min={FOURTH_SEASON_START_DATE} max={FOURTH_SEASON_END_DATE} value={slotDraft.slot_date} onChange={(event) => setSlotDraft((current) => ({ ...current, slot_date: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-oriwan-border bg-white px-3 text-sm font-black text-oriwan-text outline-none focus:border-blue-500" /></label>
            <label className="text-[11px] font-black text-oriwan-text-muted">시작<input required type="time" value={slotDraft.start_time} onChange={(event) => setSlotDraft((current) => ({ ...current, start_time: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-oriwan-border bg-white px-3 text-sm font-black text-oriwan-text outline-none focus:border-blue-500" /></label>
            <label className="text-[11px] font-black text-oriwan-text-muted">종료<input type="time" value={slotDraft.end_time} onChange={(event) => setSlotDraft((current) => ({ ...current, end_time: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-oriwan-border bg-white px-3 text-sm font-black text-oriwan-text outline-none focus:border-blue-500" /></label>
            <label className="text-[11px] font-black text-oriwan-text-muted">정원<input required type="number" min={1} max={MAX_CORRECTIVE_SLOT_CAPACITY} inputMode="numeric" value={slotDraft.capacity} onChange={(event) => setSlotDraft((current) => ({ ...current, capacity: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-oriwan-border bg-white px-3 text-sm font-black text-oriwan-text outline-none focus:border-blue-500" /></label>
            <button type="submit" disabled={busyKey === "new-slot"} className="min-h-11 rounded-xl bg-slate-950 px-5 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-50 sm:col-span-2 lg:col-span-1">{busyKey === "new-slot" ? "추가 중…" : "일정 추가"}</button>
          </div>
        </form>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {!loading && !slots.length ? <p className="rounded-[20px] bg-oriwan-surface-light px-4 py-8 text-center text-xs font-bold text-oriwan-text-muted md:col-span-2 xl:col-span-3">등록된 가능 일정이 없습니다.</p> : null}
          {slots.map((slot) => {
            const reservedCount = Math.max(0, slot.capacity - slot.remaining_capacity);
            const capacityDraft = slotCapacityDrafts[slot.id] ?? String(slot.capacity);
            const capacityNumber = Number(capacityDraft);
            const slotBusy = busyKey === `slot:${slot.id}`;
            return (
              <article key={slot.id} className={`rounded-[20px] p-4 ring-1 ${slot.active ? "bg-white ring-blue-100" : "bg-slate-50 opacity-70 ring-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-oriwan-text">{formatDate(slot.slot_date)}</p>
                    <p className="mt-1 text-xs font-bold text-oriwan-text-muted">{formatTime(slot.start_time)}{slot.end_time ? `–${formatTime(slot.end_time)}` : ""}</p>
                  </div>
                  <button type="button" role="switch" aria-checked={slot.active} disabled={slotBusy} onClick={() => void updateSlot(slot, { active: !slot.active })} className={`relative h-7 w-12 shrink-0 rounded-full transition ${slot.active ? "bg-blue-600" : "bg-slate-300"} disabled:opacity-50`}>
                    <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${slot.active ? "left-6" : "left-1"}`} />
                    <span className="sr-only">{slot.active ? "신청 가능" : "신청 닫힘"}</span>
                  </button>
                </div>
                <div className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-3">
                  <label className="min-w-0 flex-1 text-[10px] font-black text-oriwan-text-muted">정원<input type="number" min={Math.max(1, reservedCount)} max={MAX_CORRECTIVE_SLOT_CAPACITY} inputMode="numeric" value={capacityDraft} onChange={(event) => setSlotCapacityDrafts((current) => ({ ...current, [slot.id]: event.target.value }))} className="mt-1 min-h-10 w-full rounded-xl border border-oriwan-border bg-white px-3 text-sm font-black text-oriwan-text outline-none focus:border-blue-500" /></label>
                  <p className="pb-3 text-[11px] font-black text-oriwan-text-muted">신청 {reservedCount}명</p>
                  <button type="button" disabled={slotBusy || !Number.isInteger(capacityNumber) || capacityNumber < Math.max(1, reservedCount) || capacityNumber > MAX_CORRECTIVE_SLOT_CAPACITY || capacityNumber === slot.capacity} onClick={() => void updateSlot(slot, { capacity: capacityNumber })} className="min-h-10 rounded-xl bg-blue-50 px-3 text-[11px] font-black text-blue-700 disabled:opacity-35">저장</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
