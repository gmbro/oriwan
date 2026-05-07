"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/admin";
import { IconCheck } from "@/components/icons";
import { ScoreBadge } from "@/components/score-badge";
import { CHALLENGE_END_DATE, CHALLENGE_START_DATE, clampToChallengeWindow } from "@/lib/challenge";
import { imageFileToOptimizedDataUrl } from "@/lib/image-client";
import { parseDurationToSeconds, secondsToPace, secondsToTime, toIsoDate } from "@/lib/run-records";
import { SCORE_WEIGHTS, buildScoreRows } from "@/lib/scoring";

type Participant = {
  id: string;
  name: string;
  active: boolean;
  display_order: number;
};

type RecordStatus = "certified" | "needs_review" | "missing" | "rejected";

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
  participants?: { id: string; name: string } | null;
};

type RecordDraft = {
  participant_id: string;
  record_date: string;
  distance_km: string;
  duration: string;
  status: RecordStatus;
  source_app: string;
  notes: string;
};

type AnalysisResult = {
  id: string | null;
  file_name: string;
  participant_id?: string | null;
  participant_name?: string | null;
  record_date?: string | null;
  distance_km?: number | null;
  duration_seconds?: number | null;
  status?: RecordStatus;
  notes?: string | null;
};

type AdminOtpType = "email" | "magiclink" | "signup";
type AdminModal = "participant" | "record" | "upload" | null;
type AdminBoardFilter = "all" | "certified" | "missing" | "review";
type AdminBoardStatus = "certified" | "missing" | "review";

const today = toIsoDate(new Date());
const effectiveToday = today > CHALLENGE_END_DATE ? CHALLENGE_END_DATE : today;
const initialRecordDate = clampToChallengeWindow(today);
const rangeStart = CHALLENGE_START_DATE;
const adminBoardFilterOptions: { value: AdminBoardFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "certified", label: "완료" },
  { value: "missing", label: "아직" },
  { value: "review", label: "확인" },
];

function statusLabel(status: RecordStatus) {
  if (status === "certified") return "완료";
  if (status === "needs_review") return "확인 중";
  if (status === "rejected") return "반려";
  return "아직";
}

function statusClass(status: RecordStatus) {
  if (status === "certified") return "bg-lime-100 text-lime-900 border-lime-200";
  if (status === "needs_review") return "bg-orange-100 text-orange-900 border-orange-200";
  if (status === "rejected") return "bg-rose-100 text-rose-900 border-rose-200";
  return "bg-slate-100 text-slate-400 border-slate-200";
}

function adminBoardStatus(record?: RunRecord): AdminBoardStatus {
  if (record?.status === "certified") return "certified";
  if (record?.status === "needs_review" || record?.status === "rejected") return "review";
  return "missing";
}

function adminBoardStatusLabel(status: AdminBoardStatus) {
  if (status === "certified") return "완료";
  if (status === "review") return "확인";
  return "아직";
}

function adminBoardCardClass(status: AdminBoardStatus) {
  if (status === "certified") return "bg-lime-300 text-slate-950 ring-lime-400/70 shadow-sm shadow-lime-300/40";
  if (status === "review") return "bg-orange-100 text-orange-950 ring-orange-200";
  return "bg-white text-slate-500 ring-slate-950/5";
}

function recordPriority(status?: RecordStatus) {
  if (status === "certified") return 3;
  if (status === "needs_review" || status === "rejected") return 2;
  return 1;
}

function makeDraft(record: RunRecord): RecordDraft {
  return {
    participant_id: record.participant_id || "",
    record_date: record.record_date || today,
    distance_km: record.distance_km ? String(record.distance_km) : "",
    duration: record.duration_seconds ? secondsToTime(record.duration_seconds) : "",
    status: record.status || "needs_review",
    source_app: record.source_app || "",
    notes: record.notes || "",
  };
}

function polyline(points: { x: number; y: number }[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export default function AdminPage() {
  const router = useRouter();
  const autoSentRef = useRef(false);
  const loadInFlightRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
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
  const [drafts, setDrafts] = useState<Record<string, RecordDraft>>({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [targetDate, setTargetDate] = useState(initialRecordDate);
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [uploadParticipantId, setUploadParticipantId] = useState("");
  const [manualParticipantId, setManualParticipantId] = useState("");
  const [manualDate, setManualDate] = useState(initialRecordDate);
  const [manualDistance, setManualDistance] = useState("");
  const [manualDuration, setManualDuration] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [adminBoardFilter, setAdminBoardFilter] = useState<AdminBoardFilter>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "polling">("connecting");
  const [setupMessage, setSetupMessage] = useState("");
  const [adminModal, setAdminModal] = useState<AdminModal>(null);
  const [editingParticipantId, setEditingParticipantId] = useState("");

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
      setSelectedParticipantId((current) => current || nextParticipants[0]?.id || "");
      setManualParticipantId((current) => current || nextParticipants[0]?.id || "");
      setDrafts(Object.fromEntries(nextRecords.map((record: RunRecord) => [record.id, makeDraft(record)])));
      setLastUpdated(new Date());
    } catch (err) {
      setSetupMessage(err instanceof Error ? err.message : "데이터를 불러오지 못했어요. 잠시 후 다시 확인해주세요.");
    } finally {
      loadInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      if (document.visibilityState === "visible") loadData(false);
    }, 400);
  }, [loadData]);

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAuthReady(true);
        setLoading(false);
        return;
      }

      if (!isAdminEmail(user.email)) {
        await supabase.auth.signOut();
        setAuthMessage("지정된 관리자 이메일로만 들어올 수 있어요.");
        setAuthReady(true);
        setLoading(false);
        return;
      }

      setAuthorized(true);
      setUserName(user.user_metadata?.full_name || user.email?.split("@")[0] || "운영자");
      setUserAvatar(user.user_metadata?.avatar_url || "");
      await loadData();
      setAuthReady(true);
    };
    init();
  }, [loadData]);

  useEffect(() => {
    if (!mounted || !authorized) return;

    const supabase = createClient();
    const channel = supabase
      .channel("snasa-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => {
        setLiveStatus("live");
        scheduleRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_run_records" }, () => {
        setLiveStatus("live");
        scheduleRefresh();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveStatus("live");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLiveStatus("polling");
      });

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setLiveStatus((current) => current === "live" ? "live" : "polling");
        loadData(false);
      }
    }, 30000);

    return () => {
      window.clearInterval(interval);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [authorized, loadData, mounted, scheduleRefresh]);

  const todayRecords = useMemo(() => records.filter((record) => record.record_date === today), [records]);
  const certifiedToday = useMemo(() => new Set(
    todayRecords
      .filter((record) => record.status === "certified" && record.participant_id)
      .map((record) => record.participant_id)
  ).size, [todayRecords]);
  const totalDistance = useMemo(() => todayRecords.reduce((sum, record) => sum + (record.distance_km || 0), 0), [todayRecords]);
  const totalTime = useMemo(() => todayRecords.reduce((sum, record) => sum + (record.duration_seconds || 0), 0), [todayRecords]);

  const scoreRows = useMemo(() => buildScoreRows({
    participants,
    records,
    challengeStartDate: CHALLENGE_START_DATE,
    referenceDate: effectiveToday,
  }), [participants, records]);

  const adminBoard = useMemo(() => {
    const selectedDateMap = new Map<string, RunRecord>();
    records.forEach((record) => {
      if (!record.participant_id || record.record_date !== targetDate) return;
      const existing = selectedDateMap.get(record.participant_id);
      if (!existing || recordPriority(record.status) > recordPriority(existing.status)) {
        selectedDateMap.set(record.participant_id, record);
      }
    });

    const cards = participants.map((participant) => {
      const record = selectedDateMap.get(participant.id);
      const status = adminBoardStatus(record);
      return { participant, record, status };
    });

    const certified = cards.filter((card) => card.status === "certified").length;
    const review = cards.filter((card) => card.status === "review").length;
    const missing = Math.max(cards.length - certified - review, 0);

    return { cards, certified, review, missing };
  }, [participants, records, targetDate]);

  const adminBoardCards = useMemo(() => {
    if (adminBoardFilter === "all") return adminBoard.cards;
    return adminBoard.cards.filter((card) => card.status === adminBoardFilter);
  }, [adminBoard.cards, adminBoardFilter]);

  const selectedSeries = useMemo(() => {
    const participantRecords = records
      .filter((record) => record.participant_id === selectedParticipantId && record.record_date)
      .sort((a, b) => String(a.record_date).localeCompare(String(b.record_date)));
    return participantRecords;
  }, [records, selectedParticipantId]);

  const graph = useMemo(() => {
    const width = 320;
    const height = 128;
    const padding = 18;
    const distanceMax = Math.max(1, ...selectedSeries.map((record) => record.distance_km || 0));
    const timeMax = Math.max(1, ...selectedSeries.map((record) => (record.duration_seconds || 0) / 60));
    const makePoints = (kind: "distance" | "time") => selectedSeries.map((record, index) => {
      const x = selectedSeries.length <= 1 ? width / 2 : padding + (index / (selectedSeries.length - 1)) * (width - padding * 2);
      const value = kind === "distance" ? (record.distance_km || 0) : (record.duration_seconds || 0) / 60;
      const max = kind === "distance" ? distanceMax : timeMax;
      const y = height - padding - (value / max) * (height - padding * 2);
      return { x, y };
    });
    return { width, height, distancePoints: makePoints("distance"), timePoints: makePoints("time") };
  }, [selectedSeries]);

  const addParticipant = useCallback(async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      setNewName("");
      await loadData();
    } else {
      alert("멤버를 저장하지 못했어요. 이름을 다시 확인해주세요.");
    }
  }, [loadData, newName]);

  const editingParticipant = useMemo(
    () => participants.find((participant) => participant.id === editingParticipantId) || null,
    [editingParticipantId, participants]
  );

  const uploadParticipant = useMemo(
    () => participants.find((participant) => participant.id === uploadParticipantId) || null,
    [participants, uploadParticipantId]
  );

  const startEditParticipant = useCallback((participant: Participant) => {
    setEditingParticipantId(participant.id);
    setNewName(participant.name);
  }, []);

  const resetParticipantForm = useCallback(() => {
    setEditingParticipantId("");
    setNewName("");
  }, []);

  const openUploadForDate = useCallback((date: string, participantId = "") => {
    setTargetDate(date);
    setUploadParticipantId(participantId);
    setFiles([]);
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
      body: JSON.stringify({ name: newName }),
    });

    if (res.ok) {
      resetParticipantForm();
      await loadData();
    } else {
      alert("멤버 정보를 수정하지 못했어요.");
    }
  }, [addParticipant, editingParticipantId, loadData, newName, resetParticipantForm]);

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

  const analyzeImages = useCallback(async () => {
    if (!files.length) return;
    setAnalyzing(true);
    setAnalysisMessage("");
    setAnalysisResults([]);
    try {
      const images = await Promise.all(files.map(async (file) => ({ name: file.name, dataUrl: await imageFileToOptimizedDataUrl(file) })));
      const res = await fetch("/api/records/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate, participantId: uploadParticipantId || null, images }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "analysis failed");
      setFiles([]);
      const results = (Array.isArray(json.results) ? json.results : []) as AnalysisResult[];
      setAnalysisResults(results);
      const certified = results.filter((result: { status?: string }) => result.status === "certified").length;
      const review = results.length - certified;
      const ownerLabel = uploadParticipant ? `${uploadParticipant.name}님 ` : "";
      setAnalysisMessage(`${ownerLabel}${results.length}장 정리 완료 · 완료 ${certified}건 · 확인 ${review}건`);
      await loadData();
    } catch (err) {
      setAnalysisMessage(err instanceof Error ? err.message : "이미지를 읽지 못했어요. 흐린 이미지는 직접 입력으로 가볍게 보완해주세요.");
    } finally {
      setAnalyzing(false);
    }
  }, [files, loadData, targetDate, uploadParticipant, uploadParticipantId]);

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
        status: manualDistance && duration ? "certified" : "needs_review",
        notes: duration ? null : "시간 직접 입력 필요",
      }),
    });
    if (res.ok) {
      setManualDistance("");
      setManualDuration("");
      setAdminModal(null);
      await loadData();
    } else {
      alert("기록을 저장하지 못했어요.");
    }
  }, [loadData, manualDate, manualDistance, manualDuration, manualParticipantId]);

  const updateDraft = useCallback((recordId: string, patch: Partial<RecordDraft>) => {
    setDrafts((current) => ({ ...current, [recordId]: { ...current[recordId], ...patch } }));
  }, []);

  const saveDraft = useCallback(async (recordId: string) => {
    const draft = drafts[recordId];
    if (!draft) return;
    const duration = parseDurationToSeconds(draft.duration);
    const res = await fetch(`/api/records/${recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: draft.participant_id || null,
        record_date: draft.record_date,
        distance_km: draft.distance_km,
        duration_seconds: duration,
        source_app: draft.source_app,
        status: draft.status,
        notes: draft.notes,
      }),
    });
    if (res.ok) await loadData();
    else alert("수정 내용을 저장하지 못했어요.");
  }, [drafts, loadData]);

  const deleteRecord = useCallback(async (recordId: string) => {
    if (!window.confirm("이 러닝 기록을 삭제할까요?")) return;
    const res = await fetch(`/api/records/${recordId}`, { method: "DELETE" });
    if (res.ok) await loadData();
    else alert("기록을 삭제하지 못했어요.");
  }, [loadData]);

  const sendAdminCode = useCallback(async () => {
    setSendingCode(true);
    setAuthMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: ADMIN_EMAIL,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      setAuthMessage("인증번호를 보내지 못했어요. Supabase 이메일 OTP 설정을 확인해주세요.");
    } else {
      setCodeSent(true);
      setAuthMessage("관리자 이메일로 인증번호를 보냈어요. 메일함을 확인해주세요.");
    }
    setSendingCode(false);
  }, []);

  useEffect(() => {
    if (!mounted || !authReady || authorized || autoSentRef.current) return;

    autoSentRef.current = true;
    sendAdminCode();
  }, [authReady, authorized, mounted, sendAdminCode]);

  const verifyAdminCode = useCallback(async () => {
    const token = otp.replace(/\D/g, "");
    if (!token) return;
    setVerifyingCode(true);
    setAuthMessage("");
    const supabase = createClient();
    const verifyTypes: AdminOtpType[] = ["email", "magiclink", "signup"];
    let adminUser = null;
    let lastErrorMessage = "";

    for (const type of verifyTypes) {
      const { data, error } = await supabase.auth.verifyOtp({
        email: ADMIN_EMAIL,
        token,
        type,
      });

      if (!error && data.user) {
        adminUser = data.user;
        break;
      }

      lastErrorMessage = error?.message || lastErrorMessage;
      if (error?.status === 429) break;
    }

    if (!adminUser || !isAdminEmail(adminUser.email)) {
      await supabase.auth.signOut();
      setAuthMessage(
        lastErrorMessage.includes("rate limit") || lastErrorMessage.includes("429")
          ? "요청이 잠시 몰렸어요. 1분 정도 뒤 새 인증번호로 다시 시도해주세요."
          : "인증번호가 맞지 않거나 만료됐어요. 새 번호를 받아 다시 들어와주세요."
      );
      setAuthorized(false);
    } else {
      setAuthorized(true);
      setUserName(adminUser.user_metadata?.full_name || "운영자");
      setUserAvatar(adminUser.user_metadata?.avatar_url || "");
      await loadData();
    }
    setVerifyingCode(false);
  }, [loadData, otp]);

  const handleLogout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST" }).then(() => {
      setAuthorized(false);
      setUserName("");
      setUserAvatar("");
      router.refresh();
    });
  }, [router]);

  if (!mounted || !authReady) return <div className="min-h-screen bg-oriwan-bg" />;

  if (!authorized) {
    return (
      <main className="min-h-screen bg-oriwan-bg px-5 py-8 flex items-center justify-center">
        <div className="fixed top-[-20%] right-[-15%] w-[420px] h-[420px] rounded-full bg-oriwan-primary/15 blur-[130px] pointer-events-none" />
        <div className="relative w-full max-w-[430px]">
          <div className="card p-7 sm:p-9">
            <div className="mb-7 flex items-center gap-3">
              <Image src="/oriwan-logo-v2.png" alt="스내사 3기 대시보드" width={54} height={54} className="rounded-2xl" />
              <div>
                <p className="text-xs font-black text-oriwan-primary">ADMIN ONLY</p>
                <h1 className="text-2xl font-black tracking-[-0.04em] text-oriwan-text">어드민 접속</h1>
              </div>
            </div>

            <p className="text-sm leading-6 text-oriwan-text-muted">
              어드민에 들어오면 인증번호가 자동으로 발송돼요. 메일함에서 받은 번호를 입력하면 바로 관리 화면으로 이동합니다.
            </p>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-oriwan-surface-light px-4 py-3 text-center text-xs font-black text-oriwan-text-muted">
                {sendingCode ? "인증번호 보내는 중..." : codeSent ? "인증번호를 보냈어요." : "어드민 접속을 준비하고 있어요."}
              </div>
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") verifyAdminCode();
                }}
                inputMode="numeric"
                placeholder="메일로 받은 인증번호"
                className="w-full rounded-2xl border border-oriwan-border bg-white px-4 py-3 text-center text-lg font-black tracking-[0.25em] outline-none focus:border-oriwan-primary"
              />
              <button onClick={verifyAdminCode} disabled={!otp.trim() || verifyingCode} className="w-full rounded-2xl bg-lime-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40">
                {verifyingCode ? "확인하는 중..." : "어드민으로 들어가기"}
              </button>
              <button
                onClick={sendAdminCode}
                disabled={sendingCode}
                className="w-full rounded-2xl px-4 py-2 text-xs font-black text-oriwan-text-muted transition hover:bg-oriwan-surface-light hover:text-oriwan-text disabled:opacity-50"
              >
                {sendingCode ? "재발송 중..." : "인증번호 다시 보내기"}
              </button>
            </div>

            {authMessage && <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-oriwan-text-muted">{authMessage}</p>}

            <div className="mt-6 flex items-center justify-between text-xs font-bold text-oriwan-text-muted">
              <Link href="/" className="hover:text-oriwan-text">메인으로</Link>
              <Link href="/dashboard" className="hover:text-oriwan-text">팀 보드 보기</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-oriwan-bg">
      <header className="sticky top-0 z-50 px-4 py-3 bg-[#101522]/92 backdrop-blur-2xl border-b border-white/10 text-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl overflow-hidden ring-1 ring-white/20 bg-lime-300">
              <Image src="/oriwan-logo-v2.png" alt="스내사 3기 대시보드" width={36} height={36} className="object-cover" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight leading-none">스내사 3기 어드민</h1>
              <p className="text-[11px] text-white/55 mt-1">멤버와 러닝 기록을 빠르게 정리해요</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black ${liveStatus === "live" ? "bg-lime-300 text-slate-950" : "bg-white/10 text-white/70"}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              {liveStatus === "live" ? "LIVE" : liveStatus === "polling" ? "SYNC" : "연결 중"}
            </span>
            {userAvatar && <img src={userAvatar} alt="" width={28} height={28} className="rounded-full border border-white/20" />}
            <span className="hidden md:inline text-xs font-semibold text-white/60">{userName}</span>
            <button onClick={handleLogout} className="text-xs text-white/55 hover:text-white transition-colors font-medium">로그아웃</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4 pb-10">
        <section className="relative overflow-hidden rounded-[28px] bg-[#101522] px-5 py-5 text-white shadow-2xl shadow-slate-950/10">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lime-300/25 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-24 w-72 -translate-x-1/2 rounded-full bg-orange-400/15 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-lime-200 ring-1 ring-white/10">SNASA RUNNING CLUB · 3RD</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-[-0.04em]">오늘의 러닝을 착착 정리해요</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/60">날짜를 누르거나 이미지를 한꺼번에 넣으면 멤버와 기록을 빠르게 정리합니다.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-bold text-white/45">오늘</p>
                <p className="text-sm font-black text-white">{today}</p>
              </div>
              <div className="rounded-2xl bg-lime-300 px-4 py-3 text-slate-950">
                <p className="text-[10px] font-bold opacity-60">인증률</p>
                <p className="text-sm font-black">{participants.length ? Math.round((certifiedToday / participants.length) * 100) : 0}%</p>
              </div>
              <div className="col-span-2 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10 sm:col-span-1">
                <p className="text-[10px] font-bold text-white/45">업데이트</p>
                <p className="text-sm font-black text-white">{lastUpdated ? lastUpdated.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-"}</p>
              </div>
            </div>
          </div>
          <div className="relative mt-4 grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => openUploadForDate(effectiveToday)} className="rounded-2xl bg-lime-300 px-4 py-3 text-left text-sm font-black text-slate-950">
              이미지 올리기
              <span className="mt-1 block text-[11px] font-bold opacity-65">멤버별 여러 장 등록</span>
            </button>
            <button
              type="button"
              onClick={() => {
                resetParticipantForm();
                setAdminModal("participant");
              }}
              className="rounded-2xl bg-white/10 px-4 py-3 text-left text-sm font-black text-white ring-1 ring-white/10"
            >
              멤버 관리
              <span className="mt-1 block text-[11px] font-bold text-white/50">추가 · 변경 · 삭제</span>
            </button>
            <button type="button" onClick={() => setAdminModal("record")} className="rounded-2xl bg-white/10 px-4 py-3 text-left text-sm font-black text-white ring-1 ring-white/10">
              직접 입력
              <span className="mt-1 block text-[11px] font-bold text-white/50">이미지가 흐릴 때 빠르게</span>
            </button>
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

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard title="전체 멤버" value={`${participants.length}명`} />
          <SummaryCard title="오늘 완료" value={`${certifiedToday}/${participants.length}`} />
          <SummaryCard title="오늘 거리" value={`${totalDistance.toFixed(1)}km`} />
          <SummaryCard title="오늘 시간" value={secondsToTime(totalTime)} />
        </section>

        <section className="card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-oriwan-text">오늘 인증 편집</h2>
                <div className="group relative">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-oriwan-surface-light text-[11px] font-black text-oriwan-text-muted">?</span>
                  <div className="pointer-events-none absolute left-0 top-7 z-10 hidden w-64 rounded-2xl bg-slate-950 p-3 text-[11px] font-bold leading-5 text-white/80 shadow-2xl group-hover:block">
                    공통 대시보드의 오늘 인증 상태를 편집하는 영역이에요. 멤버 카드를 누르면 해당 날짜와 멤버로 이미지 등록이 바로 열립니다.
                  </div>
                </div>
              </div>
              <p className="mt-1 text-xs text-oriwan-text-muted">
                {targetDate} · 완료 {adminBoard.certified}명 · 아직 {adminBoard.missing}명{adminBoard.review ? ` · 확인 ${adminBoard.review}명` : ""}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:min-w-[280px] sm:items-end">
              <input
                type="date"
                min={CHALLENGE_START_DATE}
                max={CHALLENGE_END_DATE}
                value={targetDate}
                onChange={(event) => {
                  setTargetDate(event.target.value);
                  setAdminBoardFilter("all");
                }}
                className="w-full rounded-2xl border border-oriwan-border bg-white px-3 py-2 text-sm font-black text-oriwan-text sm:w-[170px]"
              />
              <button
                type="button"
                onClick={() => openUploadForDate(targetDate)}
                className="w-full rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-lime-200 sm:w-auto"
              >
                이 날짜 이미지 올리기
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 rounded-full bg-oriwan-surface-light p-1 ring-1 ring-slate-950/5">
            {adminBoardFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAdminBoardFilter(option.value)}
                className={`rounded-full px-2 py-1.5 text-[11px] font-black transition ${
                  adminBoardFilter === option.value ? "bg-slate-950 text-lime-200 shadow-sm" : "text-oriwan-text-muted hover:text-oriwan-text"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
            {adminBoardCards.map((card) => (
              <button
                key={card.participant.id}
                type="button"
                onClick={() => openUploadForDate(targetDate, card.participant.id)}
                title={`${card.participant.name} · ${targetDate} · ${adminBoardStatusLabel(card.status)} · 이미지 올리기`}
                className={`min-h-[60px] rounded-2xl px-2 py-2 text-center ring-1 transition hover:-translate-y-0.5 hover:ring-lime-300 ${adminBoardCardClass(card.status)}`}
              >
                <span
                  className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                    card.status === "certified"
                      ? "bg-slate-950 text-lime-200"
                      : card.status === "review"
                        ? "bg-orange-200 text-orange-950"
                        : "bg-slate-100 text-slate-300"
                  }`}
                >
                  {card.status === "certified" ? <IconCheck size={12} /> : card.status === "review" ? "!" : "+"}
                </span>
                <span className="mt-1 block truncate text-[12px] font-black tracking-[-0.04em] sm:text-[13px]">{card.participant.name}</span>
                <span className="mt-0.5 block text-[9px] font-black opacity-60">{adminBoardStatusLabel(card.status)}</span>
              </button>
            ))}
            {!adminBoardCards.length && !loading && (
              <p className="col-span-3 rounded-2xl bg-white px-4 py-8 text-center text-sm text-oriwan-text-muted">
                지금 조건에 맞는 멤버가 없어요.
              </p>
            )}
          </div>
        </section>

        <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-5">
          <div className="card p-4">
            <div className="mb-4">
              <h2 className="text-lg font-black text-oriwan-text">러닝 에너지 점수</h2>
              <p className="mt-1 text-xs text-oriwan-text-muted">
                인증 +{SCORE_WEIGHTS.certification}, 꾸준함 +{SCORE_WEIGHTS.consistency}, 성장 +{SCORE_WEIGHTS.growth}을 크게 반영해요.
              </p>
            </div>
            <div className="space-y-2">
              {scoreRows.map((row, index) => (
                <div key={row.participant.id} className="rounded-2xl bg-oriwan-surface-light px-3 py-3">
                  <div className="grid grid-cols-[32px_1fr_auto] items-center gap-3">
                    <div className="text-sm font-black text-oriwan-primary">{index + 1}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-oriwan-text">{row.participant.name}</p>
                      <p className="text-[11px] text-oriwan-text-muted">
                        완료 {row.certifiedCount}회 · 연속 {row.longestStreak}일 · 성장 {row.growthDays}일
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <ScoreBadge kind={row.badgeKind} />
                      <span className="text-lg font-black tracking-[-0.05em] text-oriwan-text">{row.score}점</span>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[10px] font-black text-oriwan-text-muted">
                    <span className="rounded-lg bg-white px-1 py-1">완료 {row.breakdown.certification}</span>
                    <span className="rounded-lg bg-white px-1 py-1">꾸준 {row.breakdown.consistency}</span>
                    <span className="rounded-lg bg-white px-1 py-1">성장 {row.breakdown.growth}</span>
                    <span className="rounded-lg bg-white px-1 py-1">시간 {row.breakdown.time}</span>
                    <span className="rounded-lg bg-white px-1 py-1">거리 {row.breakdown.distance}</span>
                  </div>
                </div>
              ))}
              {!scoreRows.length && !loading && <p className="py-8 text-center text-sm text-oriwan-text-muted">기록이 쌓이면 에너지 점수가 채워져요.</p>}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-black text-oriwan-text">멤버별 러닝 그래프</h2>
                <p className="text-xs text-oriwan-text-muted mt-1">파란 선은 거리, 초록 선은 시간이에요.</p>
              </div>
              <select value={selectedParticipantId} onChange={(e) => setSelectedParticipantId(e.target.value)} className="rounded-xl border border-oriwan-border px-3 py-2 text-sm bg-white">
                {participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}
              </select>
            </div>
            <div className="rounded-3xl bg-slate-950 p-4 overflow-hidden ring-1 ring-white/10">
              {selectedSeries.length ? (
                <svg viewBox={`0 0 ${graph.width} ${graph.height}`} className="w-full h-48">
                  <line x1="18" y1="110" x2="302" y2="110" stroke="rgba(255,255,255,.16)" />
                  <polyline fill="none" stroke="#60A5FA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={polyline(graph.distancePoints)} />
                  <polyline fill="none" stroke="#34D399" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={polyline(graph.timePoints)} />
                  {graph.distancePoints.map((point, index) => <circle key={`d${index}`} cx={point.x} cy={point.y} r="4" fill="#BFDBFE" />)}
                </svg>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-white/50">기록이 쌓이면 그래프가 살아나요.</div>
              )}
            </div>
          </div>
        </section>

        <details className="card overflow-hidden p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span>
              <span className="block text-lg font-black text-oriwan-text">기록 다듬기</span>
              <span className="mt-1 block text-xs text-oriwan-text-muted">필요할 때만 열어서 상태, 날짜, 거리, 시간을 빠르게 보정해요.</span>
            </span>
            <button type="button" onClick={(event) => { event.preventDefault(); loadData(); }} className="rounded-xl bg-oriwan-surface-light px-3 py-2 text-xs font-bold text-oriwan-text-muted">새로고침</button>
          </summary>
          <div className="overflow-x-auto">
            <table className="min-w-[1040px] w-full text-left text-xs">
              <thead className="text-oriwan-text-muted">
                <tr className="border-b border-oriwan-border">
                  <th className="py-2 pr-2">상태</th>
                  <th className="py-2 pr-2">멤버</th>
                  <th className="py-2 pr-2">날짜</th>
                  <th className="py-2 pr-2">거리</th>
                  <th className="py-2 pr-2">시간</th>
                  <th className="py-2 pr-2">페이스</th>
                  <th className="py-2 pr-2">출처</th>
                  <th className="py-2 pr-2">메모</th>
                  <th className="py-2 pr-2">저장</th>
                  <th className="py-2 pr-2">삭제</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const draft = drafts[record.id] || makeDraft(record);
                  return (
                    <tr key={record.id} className="border-b border-oriwan-border/60 align-top">
                      <td className="py-2 pr-2">
                        <select value={draft.status} onChange={(e) => updateDraft(record.id, { status: e.target.value as RecordStatus })} className={`rounded-lg border px-2 py-1.5 font-bold ${statusClass(draft.status)}`}>
                          <option value="certified">완료</option>
                          <option value="needs_review">확인 중</option>
                          <option value="rejected">반려</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <select value={draft.participant_id} onChange={(e) => updateDraft(record.id, { participant_id: e.target.value })} className="w-28 rounded-lg border border-oriwan-border px-2 py-1.5 bg-white">
                          <option value="">미매칭</option>
                          {participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-2"><input type="date" min={CHALLENGE_START_DATE} max={CHALLENGE_END_DATE} value={draft.record_date} onChange={(e) => updateDraft(record.id, { record_date: e.target.value })} className="rounded-lg border border-oriwan-border px-2 py-1.5" /></td>
                      <td className="py-2 pr-2"><input value={draft.distance_km} onChange={(e) => updateDraft(record.id, { distance_km: e.target.value })} className="w-20 rounded-lg border border-oriwan-border px-2 py-1.5" /></td>
                      <td className="py-2 pr-2"><input value={draft.duration} onChange={(e) => updateDraft(record.id, { duration: e.target.value })} placeholder="32:10" className="w-20 rounded-lg border border-oriwan-border px-2 py-1.5" /></td>
                      <td className="py-2 pr-2 font-bold text-oriwan-primary">{secondsToPace(record.pace_seconds_per_km)}</td>
                      <td className="py-2 pr-2"><input value={draft.source_app} onChange={(e) => updateDraft(record.id, { source_app: e.target.value })} className="w-24 rounded-lg border border-oriwan-border px-2 py-1.5" /></td>
                      <td className="py-2 pr-2"><input value={draft.notes} onChange={(e) => updateDraft(record.id, { notes: e.target.value })} className="w-56 rounded-lg border border-oriwan-border px-2 py-1.5" /></td>
                      <td className="py-2 pr-2"><button onClick={() => saveDraft(record.id)} className="rounded-lg bg-oriwan-primary px-3 py-1.5 font-bold text-white">저장</button></td>
                      <td className="py-2 pr-2"><button onClick={() => deleteRecord(record.id)} className="rounded-lg bg-rose-50 px-3 py-1.5 font-bold text-rose-700">삭제</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!records.length && !loading && <p className="py-10 text-center text-sm text-oriwan-text-muted">아직 기록이 없어요. 이미지를 올리거나 직접 입력해 첫 기록을 채워볼게요.</p>}
          </div>
        </details>

        {adminModal === "upload" && (
          <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:items-center sm:justify-center">
            <div className="card max-h-[88vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-oriwan-primary">Bulk OCR Upload</p>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-oriwan-text">
                    {uploadParticipant ? `${uploadParticipant.name}님 이미지 올리기` : "이미지 한 번에 올리기"}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-oriwan-text-muted">NRC, Garmin, Strava 캡처에서 날짜, 거리, 시간을 가볍게 읽어옵니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminModal(null)}
                  className="rounded-full bg-oriwan-surface-light px-3 py-1.5 text-xs font-black text-oriwan-text-muted"
                >
                  닫기
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                <label className="text-xs font-bold text-oriwan-text-muted">
                  멤버
                  <select
                    value={uploadParticipantId}
                    onChange={(e) => {
                      setUploadParticipantId(e.target.value);
                      setAnalysisResults([]);
                      setAnalysisMessage("");
                    }}
                    className="mt-1 block w-full rounded-2xl border border-oriwan-border bg-white px-4 py-3 text-sm font-black text-oriwan-text"
                  >
                    <option value="">이미지에서 이름 찾아보기</option>
                    {participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>{participant.name}</option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-bold text-oriwan-text-muted">
                  날짜가 안 보일 때만 쓸 날짜
                  <input
                    type="date"
                    min={CHALLENGE_START_DATE}
                    max={CHALLENGE_END_DATE}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="mt-1 block w-full rounded-2xl border border-oriwan-border bg-white px-4 py-3 text-sm font-black text-oriwan-text"
                  />
                </label>
              </div>

              <div
                className="mt-4 rounded-[28px] border-2 border-dashed border-lime-300/80 bg-lime-50/70 p-5 text-center transition hover:bg-lime-50"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const droppedFiles = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
                  setFiles(droppedFiles);
                  setAnalysisResults([]);
                  setAnalysisMessage(droppedFiles.length ? `${droppedFiles.length}장 선택됐어요. 자동 기록하기를 눌러주세요.` : "이미지 파일만 올릴 수 있어요.");
                }}
              >
                <p className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-lime-200">{files.length || "+"}</p>
                <p className="text-base font-black text-oriwan-text">러닝 이미지를 한 번에 올려주세요</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-oriwan-text-muted">
                  멤버를 선택하면 이미지에 이름이 없어도 해당 멤버 기록으로 저장돼요.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files || []));
                    setAnalysisResults([]);
                    setAnalysisMessage("");
                  }}
                  className="mx-auto mt-4 block max-w-full text-sm text-oriwan-text-muted file:mr-4 file:rounded-xl file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-bold file:text-lime-200"
                />
                <button onClick={analyzeImages} disabled={!files.length || analyzing} className="btn-primary mt-4 w-full py-3 text-sm disabled:opacity-40">
                  {analyzing ? "이미지 읽는 중..." : `자동으로 기록하기${files.length ? ` (${files.length})` : ""}`}
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
                    return (
                      <div key={`${result.file_name}-${index}`} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-950/5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-oriwan-text">
                              {result.participant_name || uploadParticipant?.name || "멤버 확인하기"}
                            </p>
                            <p className="mt-1 truncate text-[11px] font-semibold text-oriwan-text-muted">{result.file_name}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(status)}`}>
                            {statusLabel(status)}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
                          <span className="rounded-xl bg-oriwan-surface-light px-2 py-2 text-oriwan-text">{result.record_date || "날짜 확인"}</span>
                          <span className="rounded-xl bg-oriwan-surface-light px-2 py-2 text-oriwan-text">{result.distance_km ? `${result.distance_km}km` : "거리 확인"}</span>
                          <span className="rounded-xl bg-oriwan-surface-light px-2 py-2 text-oriwan-text">{result.duration_seconds ? secondsToTime(result.duration_seconds) : "시간 확인"}</span>
                        </div>
                        {result.notes && <p className="mt-2 text-[11px] font-semibold leading-5 text-oriwan-text-muted">{result.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-4 rounded-2xl bg-oriwan-surface-light px-4 py-3 text-[11px] font-bold leading-5 text-oriwan-text-muted">
                이미지에 날짜가 있으면 그 날짜를 우선으로 저장해요. 날짜가 없으면 위 날짜로 임시 저장하고 확인 상태로 남겨둡니다.
              </p>
            </div>
          </div>
        )}

        {adminModal === "participant" && (
          <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:items-center sm:justify-center">
            <div className="card max-h-[88vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.04em] text-oriwan-text">멤버 관리</h2>
                  <p className="mt-1 text-xs text-oriwan-text-muted">이름을 추가하고, 필요하면 빠르게 바꾸거나 정리해요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdminModal(null);
                    resetParticipantForm();
                  }}
                  className="rounded-full bg-oriwan-surface-light px-3 py-1.5 text-xs font-black text-oriwan-text-muted"
                >
                  닫기
                </button>
              </div>

              <div className="rounded-3xl bg-oriwan-surface-light p-4">
                <p className="mb-3 text-xs font-black text-oriwan-text">{editingParticipant ? "멤버 이름 수정" : "새 멤버 추가"}</p>
                <div className="grid gap-2">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="이름" className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
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
                  <div key={participant.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-950/5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-oriwan-text">{participant.name}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
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
          <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:items-center sm:justify-center">
            <div className="card w-full max-w-xl p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.04em] text-oriwan-text">기록 직접 입력</h2>
                  <p className="mt-1 text-xs text-oriwan-text-muted">멤버, 날짜, 거리, 시간을 넣으면 러닝 기록으로 바로 저장돼요.</p>
                </div>
                <button type="button" onClick={() => setAdminModal(null)} className="rounded-full bg-oriwan-surface-light px-3 py-1.5 text-xs font-black text-oriwan-text-muted">
                  닫기
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select value={manualParticipantId} onChange={(e) => setManualParticipantId(e.target.value)} className="rounded-xl border border-oriwan-border bg-white px-3 py-2.5 text-sm">
                  <option value="">멤버 선택</option>
                  {participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}
                </select>
                <input type="date" min={CHALLENGE_START_DATE} max={CHALLENGE_END_DATE} value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
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

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-oriwan-text-muted">{title}</p>
      <p className="text-2xl font-black text-oriwan-text tracking-[-0.04em]">{value}</p>
    </div>
  );
}
