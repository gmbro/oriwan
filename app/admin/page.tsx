"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { IconCalendar, IconCheck, IconRun, IconSync, IconTarget, IconTrash, IconX } from "@/components/icons";
import { buildMemberPictogramMap, MemberPictogram } from "@/components/member-pictogram";
import { RecoveryShieldStrip } from "@/components/recovery-shield-strip";
import { ACTUAL_CERTIFICATION_START_DATE, CHALLENGE_DAYS, CHALLENGE_START_DATE, clampToChallengeWindow, isCertificationParticipant } from "@/lib/challenge";
import { imageFileToOptimizedDataUrl } from "@/lib/image-client";
import { PARTICIPANT_RANK_SORT_OPTIONS, type ParticipantRankSortMode, sortParticipantRanks } from "@/lib/participant-ranking";
import { RECOVERY_CERTIFICATION_NOTE, addDays, formatKstTime, isCertificationCountedStatus, isRecoveryCertificationRecord, parseDurationToSeconds, secondsToTime, toIsoDate, toKstIsoDate } from "@/lib/run-records";

type Participant = {
  id: string;
  name: string;
  nickname: string | null;
  active: boolean;
  display_order: number;
};

type RecordStatus = "certified" | "needs_review" | "missing" | "rejected";
type AnalysisStatus = RecordStatus | "duplicate";

type RunRecord = {
  id: string;
  participant_id: string | null;
  record_date: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  pace_seconds_per_km: number | null;
  source_app: string | null;
  status: RecordStatus;
  confidence_score: number | null;
  image_url: string | null;
  raw_extracted_text: string | null;
  notes: string | null;
  created_at: string | null;
  participants?: { id: string; name: string } | null;
};

type AnalysisResult = {
  id: string | null;
  file_name: string;
  participant_id?: string | null;
  participant_name?: string | null;
  record_date?: string | null;
  distance_km?: number | null;
  duration_seconds?: number | null;
  status?: AnalysisStatus;
  notes?: string | null;
  edit_distance?: string;
  edit_duration?: string;
  duplicate?: boolean;
};

type PendingAnalyzeImage = {
  name: string;
  dataUrl: string;
};

const IMAGE_PREP_CONCURRENCY = 6;

async function preparePendingAnalyzeImages(files: File[], onProgress: (completed: number) => void) {
  const results = new Array<PendingAnalyzeImage>(files.length);
  let nextIndex = 0;
  let completed = 0;
  const workerCount = Math.min(IMAGE_PREP_CONCURRENCY, Math.max(1, files.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < files.length) {
      const index = nextIndex;
      nextIndex += 1;
      const file = files[index];
      results[index] = { name: file.name, dataUrl: await imageFileToOptimizedDataUrl(file) };
      completed += 1;
      onProgress(completed);
    }
  }));

  return results;
}

function MemberPicker({
  participants,
  value,
  onChange,
  placeholder = "멤버 선택",
  disabled = false,
}: {
  participants: Participant[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedParticipant = participants.find((participant) => participant.id === value) || null;

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-oriwan-border bg-white px-3.5 py-3 text-left text-base font-black text-oriwan-text outline-none transition focus:border-oriwan-primary disabled:opacity-50"
      >
        <span className={`min-w-0 truncate ${selectedParticipant ? "text-oriwan-text" : "text-oriwan-text-muted"}`}>
          {selectedParticipant?.name || placeholder}
        </span>
        <span className="shrink-0 text-sm font-black text-oriwan-text-muted" aria-hidden="true">v</span>
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[120] max-h-72 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-2xl shadow-slate-950/20 ring-1 ring-slate-950/10">
          <button
            type="button"
            onClick={() => selectValue("")}
            className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-base font-black ${
              !value ? "bg-blue-500 text-white" : "text-oriwan-text hover:bg-oriwan-surface-light"
            }`}
          >
            {placeholder}
          </button>
          {participants.map((participant) => (
            <button
              key={participant.id}
              type="button"
              onClick={() => selectValue(participant.id)}
              className={`mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-left text-base font-black ${
                value === participant.id ? "bg-blue-500 text-white" : "text-oriwan-text hover:bg-oriwan-surface-light"
              }`}
            >
              <span className="truncate">{participant.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type AdminModal = "participant" | "record" | "upload" | "participantRecords" | null;

const IMAGE_UPLOAD_CHUNK_SIZE = 20;
const MAX_BATCH_IMAGE_FILES = 20;
const now = new Date();
const today = toKstIsoDate(now);
const effectiveToday = today;
const officialCertificationEndDate = toIsoDate(addDays(new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`), CHALLENGE_DAYS - 1));
const initialRecordDate = clampToChallengeWindow(today);
const initialUploadDate = clampToChallengeWindow(today);
const rangeStart = CHALLENGE_START_DATE;

function statusLabel(status: AnalysisStatus) {
  if (status === "duplicate") return "이미 인증됨";
  if (status === "certified") return "완료";
  if (status === "needs_review") return "확인 중";
  if (status === "missing") return "보류";
  if (status === "rejected") return "반려";
  return "아직";
}

function statusClass(status: AnalysisStatus) {
  if (status === "duplicate") return "bg-slate-100 text-slate-700 border-slate-200";
  if (status === "certified") return "bg-lime-100 text-lime-900 border-lime-200";
  if (status === "needs_review") return "bg-orange-100 text-orange-900 border-orange-200";
  if (status === "missing") return "bg-slate-100 text-slate-700 border-slate-200";
  if (status === "rejected") return "bg-rose-100 text-rose-900 border-rose-200";
  return "bg-slate-100 text-slate-400 border-slate-200";
}

function gaugeColorClass(certifiedDays: number) {
  if (certifiedDays <= 10) return "bg-rose-400";
  if (certifiedDays <= 50) return "bg-amber-300";
  return "bg-lime-300";
}

function gaugeTextClass(certifiedDays: number) {
  if (certifiedDays <= 10) return "text-rose-600";
  if (certifiedDays <= 50) return "text-amber-700";
  return "text-lime-700";
}

function getImageFiles(fileList: FileList | File[]) {
  return Array.from(fileList).filter((file) => file.type.startsWith("image/"));
}

function getImageFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function getAnalysisResultKey(result: AnalysisResult, index: number) {
  return result.id || `${result.file_name}-${index}`;
}

function formatFileSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)}KB`;
  return `${bytes}B`;
}

function formatAdminDate(date: string | null | undefined) {
  if (!date) return "날짜 미정";
  const [, month, day] = date.split("-");
  if (!month || !day) return date;
  return `${month}.${day}`;
}

function formatDistanceInput(value: number | null | undefined) {
  return value ? String(value) : "";
}

function formatDurationInput(value: number | null | undefined) {
  return value ? secondsToTime(value) : "";
}

function hydrateAnalysisResult(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    edit_distance: result.edit_distance ?? formatDistanceInput(result.distance_km),
    edit_duration: result.edit_duration ?? formatDurationInput(result.duration_seconds),
  };
}

function nextRecordNotesForStatus(status: RecordStatus, record: {
  notes?: string | null;
  raw_extracted_text?: string | null;
  source_app?: string | null;
}) {
  if (status !== "certified") return record.notes ?? null;
  if (isRecoveryCertificationRecord(record)) return record.notes || RECOVERY_CERTIFICATION_NOTE;
  return null;
}

function AdminActionButton({
  title,
  meta,
  icon,
  variant = "dark",
  onClick,
}: {
  title: string;
  meta: string;
  icon: ReactNode;
  variant?: "primary" | "dark";
  onClick: () => void;
}) {
  const isPrimary = variant === "primary";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[74px] items-center justify-between gap-3 rounded-[22px] px-4 py-3 text-left transition hover:-translate-y-0.5 ${
        isPrimary
          ? "bg-lime-300 text-slate-950 shadow-lg shadow-lime-300/20"
          : "bg-white/10 text-white ring-1 ring-white/10 hover:bg-white/[0.14]"
      }`}
    >
      <span className="min-w-0">
        <span className={`block text-[11px] font-black ${isPrimary ? "text-slate-950/60" : "text-white/50"}`}>{meta}</span>
        <span className="mt-1 block text-sm font-black leading-tight">{title}</span>
      </span>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-105 ${
        isPrimary ? "bg-slate-950 text-lime-200" : "bg-white text-slate-950"
      }`}>
        {icon}
      </span>
    </button>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const loadInFlightRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [targetDate, setTargetDate] = useState(initialUploadDate);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadParticipantId, setUploadParticipantId] = useState("");
  const [uploadNewName, setUploadNewName] = useState("");
  const [addingUploadParticipant, setAddingUploadParticipant] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [updatingAnalysisKey, setUpdatingAnalysisKey] = useState("");
  const [updatingRecordId, setUpdatingRecordId] = useState("");
  const [manualParticipantId, setManualParticipantId] = useState("");
  const [manualDate, setManualDate] = useState(initialRecordDate);
  const [manualDistance, setManualDistance] = useState("");
  const [manualDuration, setManualDuration] = useState("");
  const [selectedRecordsParticipantId, setSelectedRecordsParticipantId] = useState("");
  const [recordDrafts, setRecordDrafts] = useState<Record<string, { distance: string; duration: string }>>({});
  const [liveStatus, setLiveStatus] = useState<"polling" | "syncing">("polling");
  const [setupMessage, setSetupMessage] = useState("");
  const [adminModal, setAdminModal] = useState<AdminModal>(null);
  const [editingParticipantId, setEditingParticipantId] = useState("");
  const [deletingRecordId, setDeletingRecordId] = useState("");
  const [participantSortMode, setParticipantSortMode] = useState<ParticipantRankSortMode>("certification");

  const loadData = useCallback(async (showLoading = true) => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const [participantsRes, recordsRes] = await Promise.all([
        fetch("/api/participants", { cache: "no-store" }),
        fetch(`/api/records?from=${rangeStart}&to=${effectiveToday}`, { cache: "no-store" }),
      ]);

      const participantsJson = await participantsRes.json();
      const recordsJson = await recordsRes.json();
      if ([participantsRes.status, recordsRes.status].some((status) => status === 401 || status === 403)) {
        setAuthorized(false);
        setParticipants([]);
        setRecords([]);
        setAuthMessage("관리자 이메일 인증이 필요해요.");
        setSetupMessage("");
        return;
      }
      if (participantsJson.setup_required || recordsJson.setup_required) {
        setSetupMessage("데이터 저장소 연결이 아직 준비되지 않았어요. Supabase SQL Editor에서 docs/supabase-schema.sql을 먼저 실행해주세요.");
      } else {
        setSetupMessage("");
      }
      if (!participantsRes.ok && !participantsJson.setup_required) throw new Error(participantsJson.error || "멤버 목록을 불러오지 못했어요.");
      if (!recordsRes.ok && !recordsJson.setup_required) throw new Error(recordsJson.error || "러닝 기록을 불러오지 못했어요.");
      const nextParticipants = participantsJson.participants || [];
      const nextRecords = recordsJson.records || [];

      setParticipants(nextParticipants);
      setRecords(nextRecords);
      setManualParticipantId((current) => current || nextParticipants[0]?.id || "");
    } catch (err) {
      setSetupMessage(err instanceof Error ? err.message : "데이터를 불러오지 못했어요. 잠시 후 다시 확인해주세요.");
    } finally {
      loadInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (cancelled) return;

      if (!response.ok) {
        setAuthorized(false);
        setAuthMessage(typeof json.error === "string" ? json.error : "관리자 이메일 인증이 필요해요.");
        setAuthReady(true);
        setLoading(false);
        return;
      }

      setAuthorized(true);
      setUserName(json.user?.name || "운영자");
      setUserAvatar(json.user?.avatar || "");
      await loadData();
      setAuthReady(true);
    };
    queueMicrotask(() => {
      if (!cancelled) setMounted(true);
      void init();
    });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (!mounted || !authorized) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setLiveStatus("syncing");
        void loadData(false).finally(() => setLiveStatus("polling"));
      }
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, [authorized, loadData, mounted]);

  const participantPictogramById = useMemo(() => buildMemberPictogramMap(participants), [participants]);
  const certificationParticipants = useMemo(() => participants.filter(isCertificationParticipant), [participants]);
  const certificationParticipantIds = useMemo(
    () => new Set(certificationParticipants.map((participant) => participant.id)),
    [certificationParticipants]
  );

  const participantProgress = useMemo(() => {
    const certifiedDaysByParticipant = new Map<string, Set<string>>();
    const metricsByParticipant = new Map<string, { distanceKm: number; durationSeconds: number }>();
    const recoveryUsageByParticipant = new Map<string, number>();
    records.forEach((record) => {
      if (
        !isCertificationCountedStatus(record.status) ||
        !record.participant_id ||
        !certificationParticipantIds.has(record.participant_id) ||
        !record.record_date ||
        record.record_date < ACTUAL_CERTIFICATION_START_DATE ||
        record.record_date > officialCertificationEndDate
      ) return;
      if (!certifiedDaysByParticipant.has(record.participant_id)) certifiedDaysByParticipant.set(record.participant_id, new Set());
      certifiedDaysByParticipant.get(record.participant_id)?.add(record.record_date);
      const metrics = metricsByParticipant.get(record.participant_id) || { distanceKm: 0, durationSeconds: 0 };
      metrics.distanceKm += record.distance_km || 0;
      metrics.durationSeconds += record.duration_seconds || 0;
      metricsByParticipant.set(record.participant_id, metrics);
      if (isRecoveryCertificationRecord(record)) {
        recoveryUsageByParticipant.set(record.participant_id, (recoveryUsageByParticipant.get(record.participant_id) || 0) + 1);
      }
    });

    return certificationParticipants
      .map((participant) => {
        const certifiedDays = certifiedDaysByParticipant.get(participant.id)?.size || 0;
        const rate = Math.min(Math.round((certifiedDays / CHALLENGE_DAYS) * 100), 100);
        const metrics = metricsByParticipant.get(participant.id) || { distanceKm: 0, durationSeconds: 0 };
        return {
          participant,
          pictogramIndex: participantPictogramById.get(participant.id) ?? 0,
          certifiedDays,
          rate,
          recoveryUsageCount: recoveryUsageByParticipant.get(participant.id) || 0,
          ...metrics,
        };
      })
      .sort((a, b) => (
        b.certifiedDays - a.certifiedDays ||
        b.distanceKm - a.distanceKm ||
        b.durationSeconds - a.durationSeconds ||
        a.participant.name.localeCompare(b.participant.name, "ko")
      ));
  }, [certificationParticipantIds, certificationParticipants, participantPictogramById, records]);
  const sortedParticipantProgress = useMemo(
    () => sortParticipantRanks(participantProgress, participantSortMode),
    [participantProgress, participantSortMode]
  );
  const adminStats = useMemo(() => {
    const todayCertifiedIds = new Set<string>();
    let reviewCount = 0;
    let totalDistanceKm = 0;
    let totalDurationSeconds = 0;

    records.forEach((record) => {
      const isCertificationTargetRecord = !record.participant_id || certificationParticipantIds.has(record.participant_id);
      if (record.status === "needs_review" && isCertificationTargetRecord) reviewCount += 1;
      if (!isCertificationCountedStatus(record.status)) return;
      if (!record.participant_id || !certificationParticipantIds.has(record.participant_id)) return;
      if (record.record_date === effectiveToday) todayCertifiedIds.add(record.participant_id);
      if (
        record.record_date &&
        record.record_date >= ACTUAL_CERTIFICATION_START_DATE &&
        record.record_date <= officialCertificationEndDate
      ) {
        totalDistanceKm += record.distance_km || 0;
        totalDurationSeconds += record.duration_seconds || 0;
      }
    });

    return {
      todayCertifiedCount: todayCertifiedIds.size,
      todayRate: certificationParticipants.length ? Math.round((todayCertifiedIds.size / certificationParticipants.length) * 100) : 0,
      reviewCount,
      totalDistanceKm,
      totalDurationSeconds,
    };
  }, [certificationParticipantIds, certificationParticipants.length, records]);

  const todayMissingParticipants = useMemo(() => {
    const todayCertifiedIds = new Set<string>();

    records.forEach((record) => {
      if (
        record.record_date === effectiveToday &&
        record.participant_id &&
        certificationParticipantIds.has(record.participant_id) &&
        isCertificationCountedStatus(record.status)
      ) {
        todayCertifiedIds.add(record.participant_id);
      }
    });

    return certificationParticipants.filter((participant) => !todayCertifiedIds.has(participant.id));
  }, [certificationParticipantIds, certificationParticipants, records]);

  const reviewRecords = useMemo(() => {
    return records
      .filter((record) => (
        record.status === "needs_review" &&
        (!record.participant_id || certificationParticipantIds.has(record.participant_id))
      ))
      .map((record) => ({
        record,
        participantName: record.participants?.name ||
          participants.find((participant) => participant.id === record.participant_id)?.name ||
          "멤버 미지정",
      }))
      .sort((a, b) => (
        (b.record.record_date || "").localeCompare(a.record.record_date || "") ||
        (b.record.created_at || "").localeCompare(a.record.created_at || "") ||
        b.record.id.localeCompare(a.record.id)
      ));
  }, [certificationParticipantIds, participants, records]);

  const selectedRecordsParticipant = useMemo(
    () => participants.find((participant) => participant.id === selectedRecordsParticipantId) || null,
    [participants, selectedRecordsParticipantId]
  );
  const selectedRecordsParticipantRecoveryUsageCount = useMemo(() => (
    participantProgress.find((row) => row.participant.id === selectedRecordsParticipantId)?.recoveryUsageCount || 0
  ), [participantProgress, selectedRecordsParticipantId]);

  const selectedParticipantRecords = useMemo(() => (
    records
      .filter((record) => record.participant_id === selectedRecordsParticipantId && record.record_date)
      .sort((a, b) => (b.record_date || "").localeCompare(a.record_date || "") || b.id.localeCompare(a.id))
  ), [records, selectedRecordsParticipantId]);
  const addParticipant = useCallback(async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, nickname: newNickname }),
    });
    if (res.ok) {
      setNewName("");
      setNewNickname("");
      await loadData();
    } else {
      alert("멤버를 저장하지 못했어요. 이름을 다시 확인해주세요.");
    }
  }, [loadData, newName, newNickname]);

  const editingParticipant = useMemo(
    () => participants.find((participant) => participant.id === editingParticipantId) || null,
    [editingParticipantId, participants]
  );

  const startEditParticipant = useCallback((participant: Participant) => {
    setEditingParticipantId(participant.id);
    setNewName(participant.name);
    setNewNickname(participant.nickname || "");
  }, []);

  const resetParticipantForm = useCallback(() => {
    setEditingParticipantId("");
    setNewName("");
    setNewNickname("");
  }, []);

  const openManualRecordForDate = useCallback((date: string, participantId = "") => {
    setTargetDate(date);
    setManualDate(date);
    setManualParticipantId(participantId);
    setManualDistance("");
    setManualDuration("");
    setAdminModal("record");
  }, []);

  const openUploadForDate = useCallback((date: string) => {
    setTargetDate(date);
    setFiles([]);
    setUploadParticipantId("");
    setUploadNewName("");
    setAnalysisResults([]);
    setAnalysisMessage("");
    setAdminModal("upload");
  }, []);

  const saveParticipant = useCallback(async () => {
    if (!newName.trim()) return;
    if (!editingParticipantId) {
      await addParticipant();
      return;
    }

    const res = await fetch(`/api/participants/${editingParticipantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, nickname: newNickname }),
    });

    if (res.ok) {
      resetParticipantForm();
      await loadData();
    } else {
      alert("멤버 정보를 수정하지 못했어요.");
    }
  }, [addParticipant, editingParticipantId, loadData, newName, newNickname, resetParticipantForm]);

  const deleteParticipant = useCallback(async (participantId: string) => {
    if (!window.confirm("이 멤버를 목록에서 제외할까요? 기존 러닝 기록은 그대로 보관됩니다.")) return;
    const res = await fetch(`/api/participants/${participantId}`, { method: "DELETE" });
    if (res.ok) {
      if (editingParticipantId === participantId) resetParticipantForm();
      await loadData();
    } else {
      alert("멤버를 삭제하지 못했어요.");
    }
  }, [editingParticipantId, loadData, resetParticipantForm]);

  const addUploadParticipant = useCallback(async () => {
    const name = uploadNewName.trim();
    if (!name) return;

    const existingParticipant = participants.find((participant) => participant.name.trim() === name);
    if (existingParticipant) {
      setUploadParticipantId(existingParticipant.id);
      setUploadNewName("");
      setAnalysisMessage(`${existingParticipant.name}님을 선택했어요.`);
      return;
    }

    setAddingUploadParticipant(true);
    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nickname: "" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "멤버를 저장하지 못했어요.");

      const participant = json.participant as Participant | undefined;
      if (participant?.id) {
        setParticipants((current) => (
          current.some((item) => item.id === participant.id) ? current : [...current, participant]
        ));
        setUploadParticipantId(participant.id);
        setManualParticipantId((current) => current || participant.id);
        setUploadNewName("");
        setAnalysisMessage(`${participant.name}님을 추가했어요.`);
      }
      await loadData(false);
    } catch (err) {
      setAnalysisMessage(err instanceof Error ? err.message : "멤버를 저장하지 못했어요.");
    } finally {
      setAddingUploadParticipant(false);
    }
  }, [loadData, participants, uploadNewName]);

  const postAnalyzeImages = useCallback(async (images: PendingAnalyzeImage[]) => {
    const results: AnalysisResult[] = [];

    for (let index = 0; index < images.length; index += IMAGE_UPLOAD_CHUNK_SIZE) {
      const chunk = images.slice(index, index + IMAGE_UPLOAD_CHUNK_SIZE);
      setAnalysisMessage(
        images.length <= IMAGE_UPLOAD_CHUNK_SIZE
          ? `OCR 일괄 인식 중... ${chunk.length}장`
          : `OCR 일괄 인식 중... ${Math.min(index + chunk.length, images.length)}/${images.length}`
      );
      const res = await fetch("/api/records/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate, fallbackParticipantId: uploadParticipantId || null, images: chunk }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "analysis failed");
      if (Array.isArray(json.results)) results.push(...(json.results as AnalysisResult[]).map(hydrateAnalysisResult));
    }

    return results;
  }, [targetDate, uploadParticipantId]);

  const queueDroppedImages = useCallback((fileList: FileList | File[]) => {
    const selectedImages = getImageFiles(fileList);
    setUploadDragActive(false);

    if (analyzing) {
      setAnalysisMessage("OCR 인식 중에는 새 이미지를 추가하지 않아요. 잠시만 기다려주세요.");
      return;
    }

    if (!selectedImages.length) {
      setAnalysisMessage("이미지 파일만 올릴 수 있어요.");
      return;
    }

    const existingKeys = new Set(files.map(getImageFileKey));
    const nextFiles = [...files];
    let addedCount = 0;
    let duplicateCount = 0;
    let overflowCount = 0;

    selectedImages.forEach((file) => {
      const fileKey = getImageFileKey(file);
      if (existingKeys.has(fileKey)) {
        duplicateCount += 1;
        return;
      }
      if (nextFiles.length >= MAX_BATCH_IMAGE_FILES) {
        overflowCount += 1;
        return;
      }
      existingKeys.add(fileKey);
      nextFiles.push(file);
      addedCount += 1;
    });

    setFiles(nextFiles);
    setAnalysisResults([]);
    setAnalysisMessage([
      `${nextFiles.length}장 등록 대기`,
      addedCount ? `${addedCount}장 추가` : null,
      duplicateCount ? `중복 ${duplicateCount}장 제외` : null,
      overflowCount ? `최대 ${MAX_BATCH_IMAGE_FILES}장까지만` : null,
      "버튼을 누르면 한 번에 인식합니다",
    ].filter(Boolean).join(" · "));
  }, [analyzing, files]);

  const analyzeQueuedImages = useCallback(async () => {
    if (analyzing) return;
    const queuedFiles = files.slice(0, MAX_BATCH_IMAGE_FILES);
    if (!queuedFiles.length) {
      setAnalysisMessage("이미지를 먼저 드래그앤드랍으로 올려주세요.");
      return;
    }

    setAnalysisResults([]);
    setAnalyzing(true);
    try {
      setAnalysisMessage(`이미지 최적화 중... 0/${queuedFiles.length}`);
      const images = await preparePendingAnalyzeImages(queuedFiles, (completed) => {
        setAnalysisMessage(`이미지 최적화 중... ${completed}/${queuedFiles.length}`);
      });
      setAnalysisMessage(`OCR 일괄 인식 중... ${images.length}장`);
      const results = await postAnalyzeImages(images);
      setFiles([]);
      setAnalysisResults(results);
      const certified = results.filter((result) => result.status === "certified").length;
      const duplicate = results.filter((result) => result.duplicate || result.status === "duplicate").length;
      const review = results.length - certified - duplicate;
      setAnalysisMessage(`${results.length}장 정리 완료 · 인증 반영 ${certified}건 · 이미 인증 ${duplicate}건 · 보류 ${review}건`);
      await loadData();
    } catch (err) {
      setAnalysisMessage(err instanceof Error ? err.message : "이미지를 읽지 못했어요. 흐린 이미지는 직접 입력으로 가볍게 보완해주세요.");
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, files, loadData, postAnalyzeImages]);

  const handleUploadDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setUploadDragActive(true);
  }, []);

  const handleUploadDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setUploadDragActive(false);
  }, []);

  const handleUploadDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    queueDroppedImages(event.dataTransfer.files);
  }, [queueDroppedImages]);

  const updateAnalysisParticipant = useCallback(async (resultIndex: number, participantId: string) => {
    const result = analysisResults[resultIndex];
    const participant = participants.find((item) => item.id === participantId);
    if (!result || !participant) return;

    if (result.duplicate || result.status === "duplicate") {
      setAnalysisMessage("이미 인증된 기록은 중복 저장하지 않았어요. 수정은 멤버 카드의 날짜별 기록에서 진행해주세요.");
      return;
    }

    if (!result.id) {
      setAnalysisMessage("저장된 기록이 없는 이미지예요. 날짜를 확인한 뒤 다시 자동 인식해주세요.");
      return;
    }

    const resultKey = getAnalysisResultKey(result, resultIndex);
    setUpdatingAnalysisKey(resultKey);

    try {
      const res = await fetch(`/api/records/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: participant.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "멤버를 저장하지 못했어요.");

      setAnalysisResults((current) => current.map((item, index) => (
        index === resultIndex
          ? { ...item, participant_id: participant.id, participant_name: participant.name }
          : item
      )));
      setAnalysisMessage(`${participant.name}님으로 연결했어요.`);
      await loadData(false);
    } catch (err) {
      setAnalysisMessage(err instanceof Error ? err.message : "멤버를 저장하지 못했어요.");
    } finally {
      setUpdatingAnalysisKey("");
    }
  }, [analysisResults, loadData, participants]);

  const updateAnalysisDraft = useCallback((resultIndex: number, field: "edit_distance" | "edit_duration", value: string) => {
    setAnalysisResults((current) => current.map((item, index) => (
      index === resultIndex ? { ...item, [field]: value } : item
    )));
  }, []);

  const saveAnalysisRecord = useCallback(async (resultIndex: number) => {
    const result = analysisResults[resultIndex];
    if (!result?.id) {
      setAnalysisMessage("저장된 기록이 없는 이미지예요. 날짜를 확인한 뒤 다시 자동 인식해주세요.");
      return;
    }
    if (result.duplicate || result.status === "duplicate") {
      setAnalysisMessage("이미 인증된 기록은 중복 저장하지 않았어요. 수정은 멤버 카드의 날짜별 기록에서 진행해주세요.");
      return;
    }

    const durationSeconds = parseDurationToSeconds(result.edit_duration || "");
    const hasMetric = Boolean((result.edit_distance || "").trim() || durationSeconds);
    const nextStatus: RecordStatus = result.participant_id && result.record_date && hasMetric ? "certified" : "missing";
    const nextNotes = nextRecordNotesForStatus(nextStatus, result);
    const resultKey = getAnalysisResultKey(result, resultIndex);
    setUpdatingAnalysisKey(resultKey);

    try {
      const res = await fetch(`/api/records/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance_km: result.edit_distance || null,
          duration_seconds: durationSeconds,
          status: nextStatus,
          notes: nextNotes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "기록을 수정하지 못했어요.");

      setAnalysisResults((current) => current.map((item, index) => (
        index === resultIndex
          ? {
              ...item,
              distance_km: result.edit_distance ? Number(result.edit_distance) : null,
              duration_seconds: durationSeconds,
              status: nextStatus,
              edit_distance: result.edit_distance || "",
              edit_duration: result.edit_duration || "",
              notes: nextNotes,
            }
          : item
      )));
      setAnalysisMessage(nextStatus === "certified" ? "거리와 시간을 저장했어요." : "보류 상태로 저장했어요. 멤버, 거리, 시간을 확인해주세요.");
      await loadData(false);
    } catch (err) {
      setAnalysisMessage(err instanceof Error ? err.message : "기록을 수정하지 못했어요.");
    } finally {
      setUpdatingAnalysisKey("");
    }
  }, [analysisResults, loadData]);

  const openParticipantRecords = useCallback((participantId: string) => {
    const drafts = records
      .filter((record) => record.participant_id === participantId && record.id)
      .reduce<Record<string, { distance: string; duration: string }>>((acc, record) => {
        acc[record.id] = {
          distance: formatDistanceInput(record.distance_km),
          duration: formatDurationInput(record.duration_seconds),
        };
        return acc;
      }, {});
    setSelectedRecordsParticipantId(participantId);
    setRecordDrafts(drafts);
    setAdminModal("participantRecords");
  }, [records]);

  const updateRecordDraft = useCallback((recordId: string, field: "distance" | "duration", value: string) => {
    setRecordDrafts((current) => ({
      ...current,
      [recordId]: {
        distance: current[recordId]?.distance || "",
        duration: current[recordId]?.duration || "",
        [field]: value,
      },
    }));
  }, []);

  const saveExistingRecord = useCallback(async (record: RunRecord) => {
    const draft = recordDrafts[record.id] || {
      distance: formatDistanceInput(record.distance_km),
      duration: formatDurationInput(record.duration_seconds),
    };
    const durationSeconds = parseDurationToSeconds(draft.duration);
    const hasMetric = Boolean(draft.distance.trim() || durationSeconds);
    const nextStatus: RecordStatus = record.participant_id && record.record_date && hasMetric ? "certified" : "missing";
    const nextNotes = nextRecordNotesForStatus(nextStatus, record);
    setUpdatingRecordId(record.id);

    try {
      const res = await fetch(`/api/records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance_km: draft.distance || null,
          duration_seconds: durationSeconds,
          status: nextStatus,
          notes: nextNotes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "기록을 수정하지 못했어요.");

      await loadData(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "기록을 수정하지 못했어요.");
    } finally {
      setUpdatingRecordId("");
    }
  }, [loadData, recordDrafts]);

  const deleteExistingRecord = useCallback(async (record: RunRecord) => {
    if (!record.record_date) return;
    const participantName = selectedRecordsParticipant?.name || "선택한 멤버";
    if (!window.confirm(`${participantName}님의 ${record.record_date} 인증을 삭제할까요? 삭제하면 인증률과 누적 거리/시간에서도 빠집니다.`)) return;

    setDeletingRecordId(record.id);
    try {
      const res = await fetch(`/api/records/${record.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "기록을 삭제하지 못했어요.");

      setRecordDrafts((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      await loadData(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "기록을 삭제하지 못했어요.");
    } finally {
      setDeletingRecordId("");
    }
  }, [loadData, selectedRecordsParticipant?.name]);

  const saveManualRecord = useCallback(async () => {
    const duration = parseDurationToSeconds(manualDuration);
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: manualParticipantId,
        record_date: manualDate,
        distance_km: manualDistance,
        duration_seconds: duration,
        status: manualDistance || duration ? "certified" : "needs_review",
        notes: !manualDistance || !duration ? "거리 또는 시간은 나중에 보완 가능" : null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setManualDistance("");
      setManualDuration("");
      setAdminModal(null);
      await loadData();
    } else {
      alert(typeof json.error === "string" ? json.error : "기록을 저장하지 못했어요.");
    }
  }, [loadData, manualDate, manualDistance, manualDuration, manualParticipantId]);

  const sendAdminCode = useCallback(async () => {
    setSendingCode(true);
    setAuthMessage("");
    const response = await fetch("/api/admin/session", { method: "PUT" });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      setAuthMessage(typeof json.error === "string" ? json.error : "인증번호를 보내지 못했어요. Supabase 이메일 OTP 설정을 확인해주세요.");
    } else {
      setCodeSent(true);
      setAuthMessage("관리자 이메일로 인증번호를 보냈어요. 메일함을 확인해주세요.");
    }
    setSendingCode(false);
  }, []);

  const verifyAdminCode = useCallback(async () => {
    const token = otp.replace(/\D/g, "");
    if (!token) return;
    setVerifyingCode(true);
    setAuthMessage("");
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      setAuthMessage(typeof json.error === "string" ? json.error : "인증번호가 맞지 않거나 만료됐어요. 새 번호를 받아 다시 들어와주세요.");
      setAuthorized(false);
    } else {
      setAuthorized(true);
      setUserName(json.user?.name || "운영자");
      setUserAvatar(json.user?.avatar || "");
      await loadData();
    }
    setVerifyingCode(false);
  }, [loadData, otp]);

  const handleLogout = useCallback(() => {
    fetch("/api/admin/session", { method: "DELETE" }).then(() => {
      setAuthorized(false);
      setUserName("");
      setUserAvatar("");
      router.refresh();
    });
  }, [router]);

  const isInitialAdminLoading = loading && participants.length === 0;

  if (!mounted || !authReady) return <div className="min-h-screen bg-oriwan-bg" />;

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-oriwan-bg px-3 py-6 sm:px-5 sm:py-8">
        <div className="relative w-full max-w-[430px]">
          <div className="card mobile-page-card p-6 sm:p-9">
            <div className="mb-7 flex items-center gap-3">
              <Image src="/oriwan-logo-v2.png" alt="어드민" width={54} height={54} className="rounded-2xl" />
              <div>
                <h1 className="text-2xl font-black leading-tight text-oriwan-text">어드민 접속</h1>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <button
                onClick={sendAdminCode}
                disabled={sendingCode}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-lime-200 disabled:opacity-50"
              >
                {sendingCode ? "발송 중..." : codeSent ? "인증번호 다시 발송" : "인증번호 발송"}
              </button>
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") verifyAdminCode();
                }}
                inputMode="numeric"
                placeholder="메일로 받은 인증번호"
                className="w-full rounded-2xl border border-oriwan-border bg-white px-4 py-3 text-center text-lg font-black outline-none focus:border-oriwan-primary"
              />
              <button onClick={verifyAdminCode} disabled={!otp.trim() || verifyingCode} className="w-full rounded-2xl bg-lime-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40">
                {verifyingCode ? "확인하는 중..." : "어드민으로 들어가기"}
              </button>
            </div>

            {authMessage && <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-oriwan-text-muted">{authMessage}</p>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-oriwan-bg">
      <header className="sticky top-0 z-50 px-4 py-3 bg-[#101522]/92 backdrop-blur-2xl border-b border-white/10 text-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl overflow-hidden ring-1 ring-white/20 bg-lime-300">
              <Image src="/oriwan-logo-v2.png" alt="어드민" width={36} height={36} className="object-cover" />
            </div>
            <div>
              <h1 className="text-base font-black leading-none sm:text-lg">어드민</h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black ${liveStatus === "syncing" ? "bg-lime-300 text-slate-950" : "bg-white/10 text-white/70"}`}>
              <IconSync size={13} className={liveStatus === "syncing" ? "animate-spin" : ""} />
              {liveStatus === "syncing" ? "동기화 중" : "보호 모드"}
            </span>
            {userAvatar && <Image src={userAvatar} alt="" width={28} height={28} className="rounded-full border border-white/20" />}
            <span className="hidden md:inline text-xs font-semibold text-white/60">{userName}</span>
            <button onClick={handleLogout} className="text-xs text-white/60 hover:text-white transition-colors font-medium">로그아웃</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 pb-10 sm:px-4 sm:py-5">
        <section className="relative overflow-hidden rounded-[28px] bg-[#101522] p-4 text-white shadow-2xl shadow-slate-950/15 ring-1 ring-white/10 sm:p-5 lg:p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/50 to-transparent" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-stretch">
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase text-lime-200/70">Admin Console</p>
                  <h2 className="mt-1 text-2xl font-black leading-tight text-white sm:text-3xl">오늘 운영 현황</h2>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white/70 ring-1 ring-white/10">
                  <IconCalendar size={14} />
                  {effectiveToday.slice(5).replace("-", ".")}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 rounded-[26px] bg-white/[0.07] p-4 ring-1 ring-white/10 sm:p-5">
                <div className="min-w-0">
                  <p className="text-xs font-black text-white/45">오늘 인증</p>
                  <p className="mt-1 text-[clamp(3rem,14vw,5rem)] font-black leading-none text-lime-200">{adminStats.todayRate}%</p>
                  <p className="mt-2 text-xs font-semibold text-white/55">{adminStats.todayCertifiedCount}/{certificationParticipants.length}명 인증 완료</p>
                </div>
                <div className="grid gap-2 text-right">
                  <span className="rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
                    <span className="block text-[10px] font-black text-white/40">검수 대기</span>
                    <span className="text-lg font-black text-white">{adminStats.reviewCount}</span>
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/[0.08] px-3 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-black text-white/40">누적 거리</p>
                  <p className="mt-1 text-base font-black text-white">{adminStats.totalDistanceKm.toFixed(1)}km</p>
                </div>
                <div className="rounded-2xl bg-white/[0.08] px-3 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-black text-white/40">누적 시간</p>
                  <p className="mt-1 text-base font-black text-white">{secondsToTime(adminStats.totalDurationSeconds)}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black text-white/40">오늘 미인증</p>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white ring-1 ring-white/10">
                      {todayMissingParticipants.length}
                    </span>
                  </div>
                  <div className="mt-2 max-h-36 overflow-y-auto pr-1">
                    {todayMissingParticipants.length ? (
                      <div className="grid gap-1.5">
                        {todayMissingParticipants.map((participant) => (
                          <button
                            key={participant.id}
                            type="button"
                            onClick={() => openManualRecordForDate(effectiveToday, participant.id)}
                            className="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl bg-white/[0.08] px-3 py-2 text-left ring-1 ring-white/10 transition hover:bg-white/[0.13]"
                          >
                            <span className="min-w-0 truncate text-sm font-black text-white">{participant.name}</span>
                            <span className="shrink-0 text-[10px] font-black text-lime-200">{formatAdminDate(effectiveToday)}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-lime-300/15 px-3 py-3 text-center text-xs font-black text-lime-200 ring-1 ring-lime-300/20">
                        모두 완료
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black text-white/40">검수 대기 상세</p>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white ring-1 ring-white/10">
                      {reviewRecords.length}
                    </span>
                  </div>
                  <div className="mt-2 max-h-36 overflow-y-auto pr-1">
                    {reviewRecords.length ? (
                      <div className="grid gap-1.5">
                        {reviewRecords.map(({ record, participantName }) => (
                          <button
                            key={record.id}
                            type="button"
                            onClick={() => {
                              if (record.participant_id) openParticipantRecords(record.participant_id);
                            }}
                            className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-xl bg-white/[0.08] px-3 py-2 text-left ring-1 ring-white/10 transition ${
                              record.participant_id ? "hover:bg-white/[0.13]" : "cursor-default"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black text-white">{participantName}</span>
                              <span className="mt-0.5 block truncate text-[10px] font-semibold text-white/45">
                                {record.notes || "확인 필요"}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-[10px] font-black text-lime-200">{formatAdminDate(record.record_date)}</span>
                              {record.created_at && (
                                <span className="mt-0.5 block text-[10px] font-semibold text-white/45">
                                  등록 {formatKstTime(record.created_at)}
                                </span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-lime-300/15 px-3 py-3 text-center text-xs font-black text-lime-200 ring-1 ring-lime-300/20">
                        대기 없음
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2.5">
              <AdminActionButton
                title="이미지 올리기"
                meta="OCR"
                icon={<IconRun size={18} />}
                variant="primary"
                onClick={() => openUploadForDate(initialUploadDate)}
              />
              <AdminActionButton
                title="멤버 관리"
                meta={`${participants.length}명`}
                icon={<IconTarget size={18} />}
                onClick={() => {
                  resetParticipantForm();
                  setAdminModal("participant");
                }}
              />
              <AdminActionButton
                title="직접 입력"
                meta="기록 추가"
                icon={<IconCheck size={18} />}
                onClick={() => openManualRecordForDate(effectiveToday)}
              />
            </div>
          </div>
        </section>

        {setupMessage && (
          <section className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950">
            {setupMessage}
            <span className="mt-1 block text-xs font-semibold text-amber-800">
              저장소의 docs/supabase-schema.sql 파일 전체를 Supabase Dashboard의 SQL Editor에서 실행하면 바로 연결됩니다.
            </span>
          </section>
        )}

        <section className="card mobile-page-card overflow-hidden p-0">
          <div className="border-b border-slate-950/5 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase text-oriwan-text-muted">Crew Gauge</p>
                <h2 className="mt-1 text-xl font-black leading-tight text-oriwan-text">스내사 크루별 인증게이지</h2>
              </div>
              <span className="inline-flex w-fit shrink-0 rounded-full bg-lime-300 px-3 py-1.5 text-[11px] font-black text-slate-950 shadow-sm shadow-lime-300/30">
                {isInitialAdminLoading ? "멤버 불러오는 중" : `인증 대상 ${certificationParticipants.length}명`}
              </span>
            </div>
            <div className="mt-4 flex overflow-x-auto rounded-full bg-oriwan-surface-light p-1 ring-1 ring-slate-950/5">
              {PARTICIPANT_RANK_SORT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setParticipantSortMode(option.key)}
                  aria-pressed={participantSortMode === option.key}
                  className={`min-w-[72px] flex-1 rounded-full px-3 py-2 text-[11px] font-black transition ${
                    participantSortMode === option.key
                      ? "bg-slate-950 text-lime-200 shadow-sm"
                      : "text-oriwan-text-muted hover:text-oriwan-text"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 sm:p-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {isInitialAdminLoading && Array.from({ length: 6 }, (_, index) => (
                <div key={`admin-loading-${index}`} className="rounded-[22px] bg-white px-3.5 py-3.5 ring-1 ring-slate-950/5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-10 w-10 shrink-0 animate-pulse rounded-2xl bg-oriwan-surface-light" />
                      <span className="grid min-w-0 gap-1.5">
                        <span className="block h-3 w-20 animate-pulse rounded-full bg-oriwan-surface-light" />
                        <span className="block h-5 w-32 animate-pulse rounded-full bg-oriwan-surface-light" />
                      </span>
                    </div>
                    <span className="h-6 w-11 shrink-0 animate-pulse rounded-full bg-oriwan-surface-light" />
                  </div>
                  <div className="mt-3 h-2 animate-pulse rounded-full bg-oriwan-surface-light" />
                </div>
              ))}
              {sortedParticipantProgress.map((row, index) => (
                <button
                  key={row.participant.id}
                  type="button"
                  onClick={() => openParticipantRecords(row.participant.id)}
                  className={`relative overflow-hidden rounded-[22px] bg-white px-3.5 py-3.5 text-left ring-1 ring-slate-950/5 transition hover:-translate-y-0.5 hover:ring-lime-300 hover:shadow-lg hover:shadow-slate-950/5 ${
                    row.rate >= 100 ? "gauge-complete-card" : "dashboard-gauge-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="relative shrink-0">
                        <MemberPictogram index={row.pictogramIndex} participantName={row.participant.name} className="!h-11 !w-11" />
                        <span className="absolute -left-1 -top-1 rounded-full bg-slate-950 px-1.5 py-0.5 text-[9px] font-black leading-none text-lime-200 ring-2 ring-white">
                          {index + 1}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base font-black leading-tight text-oriwan-text">{row.participant.name}</p>
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-baseline gap-1 rounded-full bg-oriwan-surface-light px-2 py-0.5 text-[10px] font-black leading-none text-oriwan-text shadow-[inset_0_0_0_1px_rgba(16,21,34,0.05)]">
                            <span className="text-[8px] font-extrabold text-oriwan-text-muted">거리</span>
                            {row.distanceKm.toFixed(1)}km
                          </span>
                          <span className="inline-flex items-baseline gap-1 rounded-full bg-oriwan-surface-light px-2 py-0.5 text-[10px] font-black leading-none text-oriwan-text shadow-[inset_0_0_0_1px_rgba(16,21,34,0.05)]">
                            <span className="text-[8px] font-extrabold text-oriwan-text-muted">시간</span>
                            {secondsToTime(row.durationSeconds)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className={`shrink-0 text-2xl font-black leading-none ${gaugeTextClass(row.certifiedDays)}`}>
                      {row.rate}%
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-oriwan-surface-light">
                    <div
                      className={`gauge-fill-flow h-full rounded-full transition-all duration-1000 ease-out ${gaugeColorClass(row.certifiedDays)}`}
                      style={{ width: `${Math.max(row.rate, row.certifiedDays ? 3 : 0)}%` }}
                    />
                  </div>
                </button>
              ))}
              {!participantProgress.length && !loading && (
                <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-oriwan-text-muted sm:col-span-2 lg:col-span-3">
                  멤버가 추가되면 인증게이지가 바로 채워집니다.
                </p>
              )}
            </div>
          </div>
        </section>
        {adminModal === "upload" && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => setAdminModal(null)}
          >
            <div className="card mobile-sheet w-full max-w-2xl overflow-y-auto p-4 sm:max-h-[86svh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black leading-tight text-oriwan-text">이미지 등록</h2>
                  <p className="mt-1 text-xs font-bold leading-5 text-oriwan-text-muted">러닝 캡처를 빠르게 읽어 대시보드에 반영해요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminModal(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                <label className="block rounded-2xl bg-oriwan-surface-light p-3 text-xs font-black text-oriwan-text-muted">
                  기준 날짜
                  <input
                    type="date"
                    min={CHALLENGE_START_DATE}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-base font-black text-oriwan-text sm:text-sm"
                  />
                </label>

                <div className="rounded-2xl bg-oriwan-surface-light p-3">
                  <p className="text-xs font-black text-oriwan-text-muted">멤버 보정</p>
                  <div className="mt-1">
                    <MemberPicker
                      participants={participants}
                      value={uploadParticipantId}
                      onChange={setUploadParticipantId}
                      placeholder="이미지에서 자동 인식"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2 flex gap-2">
                <input
                  value={uploadNewName}
                  onChange={(event) => setUploadNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addUploadParticipant();
                  }}
                  placeholder="새 멤버 이름"
                  className="min-w-0 flex-1 rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-sm font-black text-oriwan-text outline-none focus:border-oriwan-primary"
                />
                <button
                  type="button"
                  onClick={addUploadParticipant}
                  disabled={!uploadNewName.trim() || addingUploadParticipant}
                  className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-lime-200 disabled:opacity-40"
                >
                  {addingUploadParticipant ? "추가 중" : "추가"}
                </button>
              </div>

              <div
                className={`mt-3 rounded-[22px] border-2 border-dashed p-3 transition ${
                  uploadDragActive
                    ? "border-lime-400 bg-lime-100 shadow-lg shadow-lime-300/20"
                    : "border-lime-300/80 bg-lime-50/70 hover:bg-lime-50"
                }`}
                onDragEnter={handleUploadDragOver}
                onDragOver={handleUploadDragOver}
                onDragLeave={handleUploadDragLeave}
                onDrop={handleUploadDrop}
              >
                <div className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-4 text-left ring-1 ring-slate-950/5">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xl font-black text-lime-200">
                      {uploadDragActive ? "↓" : analyzing ? "…" : "+"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-black text-oriwan-text">
                        {uploadDragActive ? "여기에 놓기" : analyzing ? "일괄 OCR 인식 중" : files.length ? `${files.length}장 등록 대기` : "이미지 드래그앤드랍"}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-bold text-oriwan-text-muted">
                        {analyzing ? "최대 20장을 한 번에 읽고 있어요" : files.length ? "더 놓으면 대기 목록에 추가됩니다" : "먼저 모아두고 버튼으로 한 번에 인식합니다"}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-lime-300 px-3 py-1 text-[11px] font-black text-slate-950">
                    최대 {MAX_BATCH_IMAGE_FILES}장
                  </span>
                </div>

                {files.length > 0 && (
                  <div className="mt-3 rounded-2xl bg-white/95 p-2.5 text-left ring-1 ring-slate-950/5">
                    <div className="grid max-h-32 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
                      {files.slice(0, 8).map((file, index) => {
                        const fileKey = getImageFileKey(file);
                        return (
                          <div key={fileKey} className="flex items-center justify-between gap-2 rounded-xl bg-oriwan-surface-light px-2.5 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-black text-oriwan-text">{index + 1}. {file.name}</p>
                              <p className="mt-0.5 text-[10px] font-semibold text-oriwan-text-muted">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                        );
                      })}
                      {files.length > 8 && (
                        <div className="rounded-xl bg-slate-950 px-2.5 py-2 text-[11px] font-black text-lime-200">
                          +{files.length - 8}장 더 선택됨
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={analyzeQueuedImages}
                  disabled={analyzing || !files.length}
                  className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-lime-200 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:bg-slate-300 disabled:text-white"
                >
                  {analyzing ? "인식 중..." : files.length ? `한번에 인식하기 (${files.length})` : "이미지를 드롭하면 시작 가능"}
                </button>
              </div>

              {analysisMessage && (
                <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-black text-oriwan-text ring-1 ring-slate-950/5">
                  {analysisMessage}
                </p>
              )}

              {analysisResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {analysisResults.map((result, index) => {
                    const status = result.status || "needs_review";
                    const resultKey = getAnalysisResultKey(result, index);
                    const isUpdatingResult = updatingAnalysisKey === resultKey;
                    const isDuplicate = result.duplicate || status === "duplicate";
                    return (
                      <div key={resultKey} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-950/5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-oriwan-text">
                              {result.participant_name || "멤버 선택"}
                            </p>
                            <p className="mt-1 truncate text-[11px] font-semibold text-oriwan-text-muted">{result.file_name}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(status)}`}>
                            {statusLabel(status)}
                          </span>
                        </div>
                        <div className="mt-3">
                          <p className="text-[10px] font-black text-oriwan-text-muted">멤버</p>
                          <div className="mt-1">
                            <MemberPicker
                              participants={participants}
                              value={result.participant_id || ""}
                              onChange={(participantId) => updateAnalysisParticipant(index, participantId)}
                              disabled={!result.id || isUpdatingResult || isDuplicate}
                              placeholder={result.id ? "멤버 선택" : "저장된 기록 없음"}
                            />
                          </div>
                        </div>
                        <div className="mt-3 rounded-xl bg-oriwan-surface-light px-3 py-2 text-xs font-black text-oriwan-text">
                          날짜 {result.record_date || "확인 필요"}
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input
                            value={result.edit_distance ?? ""}
                            onChange={(event) => updateAnalysisDraft(index, "edit_distance", event.target.value)}
                            inputMode="decimal"
                            placeholder="거리 km"
                            disabled={isDuplicate}
                            className="rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-sm font-black text-oriwan-text outline-none focus:border-oriwan-primary"
                          />
                          <input
                            value={result.edit_duration ?? ""}
                            onChange={(event) => updateAnalysisDraft(index, "edit_duration", event.target.value)}
                            placeholder="시간 예: 32:10"
                            disabled={isDuplicate}
                            className="rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-sm font-black text-oriwan-text outline-none focus:border-oriwan-primary"
                          />
                          <button
                            type="button"
                            onClick={() => saveAnalysisRecord(index)}
                            disabled={!result.id || isUpdatingResult || isDuplicate}
                            className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-lime-200 disabled:opacity-40"
                          >
                            {isDuplicate ? "저장 안 함" : isUpdatingResult ? "저장 중" : "수정 저장"}
                          </button>
                        </div>
                        {result.notes && <p className="mt-2 text-[11px] font-semibold leading-5 text-oriwan-text-muted">{result.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {adminModal === "participantRecords" && selectedRecordsParticipant && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => {
              setAdminModal(null);
              setSelectedRecordsParticipantId("");
            }}
          >
            <div className="card mobile-sheet w-full max-w-2xl overflow-y-auto p-4 sm:max-h-[88vh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <MemberPictogram
                    index={participantPictogramById.get(selectedRecordsParticipant.id)}
                    participantName={selectedRecordsParticipant.name}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-oriwan-text-muted">날짜별 기록 수정</p>
                    <h2 className="truncate text-2xl font-black leading-tight text-oriwan-text">
                      {selectedRecordsParticipant.name}
                    </h2>
                    <RecoveryShieldStrip usedCount={selectedRecordsParticipantRecoveryUsageCount} className="mt-1" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdminModal(null);
                    setSelectedRecordsParticipantId("");
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="space-y-2">
                {selectedParticipantRecords.map((record) => {
                  const draft = recordDrafts[record.id] || {
                    distance: formatDistanceInput(record.distance_km),
                    duration: formatDurationInput(record.duration_seconds),
                  };
                  const isSaving = updatingRecordId === record.id;
                  const isDeleting = deletingRecordId === record.id;

                  return (
                    <div key={record.id} className="rounded-[22px] bg-white p-3 ring-1 ring-slate-950/5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-oriwan-text">{record.record_date}</p>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(record.status)}`}>
                          {statusLabel(record.status)}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                        <input
                          value={draft.distance}
                          onChange={(event) => updateRecordDraft(record.id, "distance", event.target.value)}
                          inputMode="decimal"
                          placeholder="거리 km"
                          className="rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-sm font-black text-oriwan-text outline-none focus:border-oriwan-primary"
                        />
                        <input
                          value={draft.duration}
                          onChange={(event) => updateRecordDraft(record.id, "duration", event.target.value)}
                          placeholder="시간 예: 32:10"
                          className="rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-sm font-black text-oriwan-text outline-none focus:border-oriwan-primary"
                        />
                        <button
                          type="button"
                          onClick={() => saveExistingRecord(record)}
                          disabled={isSaving || isDeleting}
                          className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-lime-200 disabled:opacity-40"
                        >
                          {isSaving ? "저장 중" : "저장"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteExistingRecord(record)}
                          disabled={isSaving || isDeleting}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100 disabled:opacity-40"
                        >
                          <IconTrash size={14} />
                          {isDeleting ? "삭제 중" : "삭제"}
                        </button>
                      </div>
                      {record.notes && <p className="mt-2 text-[11px] font-semibold leading-5 text-oriwan-text-muted">{record.notes}</p>}
                    </div>
                  );
                })}
                {!selectedParticipantRecords.length && (
                  <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-oriwan-text-muted ring-1 ring-slate-950/5">
                    아직 등록된 기록이 없어요. 이미지 올리기나 직접 입력으로 첫 기록을 넣어주세요.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {adminModal === "participant" && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => {
              setAdminModal(null);
              resetParticipantForm();
            }}
          >
            <div className="card mobile-sheet w-full max-w-2xl overflow-y-auto p-4 sm:max-h-[88vh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black leading-tight text-oriwan-text">멤버 관리</h2>
                  <p className="mt-1 text-xs text-oriwan-text-muted">이름과 자기소개를 추가하고, 필요하면 빠르게 바꾸거나 정리해요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdminModal(null);
                    resetParticipantForm();
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="rounded-3xl bg-oriwan-surface-light p-4">
                <p className="mb-3 text-xs font-black text-oriwan-text">{editingParticipant ? "멤버 정보 수정" : "새 멤버 추가"}</p>
                <div className="grid gap-2">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="이름" className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
                  <textarea
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    placeholder="자기소개"
                    rows={4}
                    className="resize-none rounded-xl border border-oriwan-border px-3 py-2.5 text-sm leading-6"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={saveParticipant} className="btn-primary flex-1 py-3 text-sm">
                    {editingParticipant ? "수정 저장" : "멤버 추가"}
                  </button>
                  {editingParticipant && (
                    <button type="button" onClick={resetParticipantForm} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-oriwan-text">
                      새 이름 입력
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex flex-col gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-950/5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2">
                      <MemberPictogram index={participantPictogramById.get(participant.id)} participantName={participant.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-oriwan-text">{participant.name}</p>
                        {participant.nickname && (
                          <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs font-semibold leading-5 text-oriwan-text-muted">
                            {participant.nickname}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:flex">
                      <button type="button" onClick={() => startEditParticipant(participant)} className="rounded-xl bg-oriwan-surface-light px-3 py-2 text-xs font-black text-oriwan-text">
                        변경
                      </button>
                      <button type="button" onClick={() => deleteParticipant(participant.id)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
                {!participants.length && <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-oriwan-text-muted">아직 멤버가 없어요. 첫 멤버부터 추가해볼까요?</p>}
              </div>
            </div>
          </div>
        )}

        {adminModal === "record" && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-4"
            onClick={() => setAdminModal(null)}
          >
            <div className="card mobile-sheet w-full max-w-xl overflow-y-auto p-4 sm:max-h-[88vh] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black leading-tight text-oriwan-text">기록 직접 입력</h2>
                  <p className="mt-1 text-xs text-oriwan-text-muted">멤버, 날짜, 거리 또는 시간만 있어도 인증으로 저장돼요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminModal(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oriwan-surface-light text-oriwan-text-muted transition hover:bg-slate-950 hover:text-lime-200"
                  aria-label="닫기"
                >
                  <IconX size={18} />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <MemberPicker participants={participants} value={manualParticipantId} onChange={setManualParticipantId} />
                <input type="date" min={CHALLENGE_START_DATE} value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
                <input value={manualDistance} onChange={(e) => setManualDistance(e.target.value)} placeholder="거리 km" inputMode="decimal" className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
                <input value={manualDuration} onChange={(e) => setManualDuration(e.target.value)} placeholder="시간 예: 32:10" className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
              </div>
              <button type="button" onClick={saveManualRecord} className="btn-primary mt-4 w-full py-3 text-sm">
                기록 저장하기
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
