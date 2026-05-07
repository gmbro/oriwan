"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/admin";
import { ACTUAL_CERTIFICATION_START_DATE, CHALLENGE_DAYS, CHALLENGE_END_DATE, CHALLENGE_START_DATE, clampToChallengeWindow } from "@/lib/challenge";
import { DASHBOARD_REFRESH_CHANNEL, DASHBOARD_REFRESH_EVENT, broadcastDashboardRefresh } from "@/lib/dashboard-refresh";
import { imageFileToOptimizedDataUrl } from "@/lib/image-client";
import { parseDurationToSeconds, secondsToTime, toIsoDate } from "@/lib/run-records";

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

const today = toIsoDate(new Date());
const effectiveToday = today > CHALLENGE_END_DATE ? CHALLENGE_END_DATE : today;
const initialRecordDate = clampToChallengeWindow(today);
const rangeStart = CHALLENGE_START_DATE;
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

export default function AdminPage() {
  const router = useRouter();
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
      setManualParticipantId((current) => current || nextParticipants[0]?.id || "");
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
      .channel(DASHBOARD_REFRESH_CHANNEL)
      .on("broadcast", { event: DASHBOARD_REFRESH_EVENT }, () => {
        setLiveStatus("live");
        scheduleRefresh();
      })
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
    }, 10000);

    return () => {
      window.clearInterval(interval);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [authorized, loadData, mounted, scheduleRefresh]);

  const participantProgress = useMemo(() => {
    const certifiedDaysByParticipant = new Map<string, Set<string>>();
    records.forEach((record) => {
      if (
        record.status !== "certified" ||
        !record.participant_id ||
        !record.record_date ||
        record.record_date < ACTUAL_CERTIFICATION_START_DATE
      ) return;
      if (!certifiedDaysByParticipant.has(record.participant_id)) certifiedDaysByParticipant.set(record.participant_id, new Set());
      certifiedDaysByParticipant.get(record.participant_id)?.add(record.record_date);
    });

    return participants
      .map((participant) => {
        const certifiedDays = certifiedDaysByParticipant.get(participant.id)?.size || 0;
        const rate = Math.round((certifiedDays / CHALLENGE_DAYS) * 100);
        return { participant, certifiedDays, rate };
      })
      .sort((a, b) => b.certifiedDays - a.certifiedDays || a.participant.name.localeCompare(b.participant.name, "ko"));
  }, [participants, records]);

  const addParticipant = useCallback(async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      setNewName("");
      void broadcastDashboardRefresh();
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

  const openManualRecordForDate = useCallback((date: string, participantId = "") => {
    setTargetDate(date);
    setManualDate(date);
    setManualParticipantId(participantId);
    setManualDistance("");
    setManualDuration("");
    setAdminModal("record");
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
      void broadcastDashboardRefresh();
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
      void broadcastDashboardRefresh();
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
      const certified = results.filter((result) => result.status === "certified").length;
      const review = results.length - certified;
      const ownerLabel = uploadParticipant ? `${uploadParticipant.name}님 ` : "";
      setAnalysisMessage(`${ownerLabel}${results.length}장 정리 완료 · 완료 ${certified}건 · 확인 ${review}건`);
      void broadcastDashboardRefresh();
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
      void broadcastDashboardRefresh();
      await loadData();
    } else {
      alert("기록을 저장하지 못했어요.");
    }
  }, [loadData, manualDate, manualDistance, manualDuration, manualParticipantId]);

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
              <Image src="/oriwan-logo-v2.png" alt="어드민" width={54} height={54} className="rounded-2xl" />
              <div>
                <h1 className="text-2xl font-black tracking-[-0.04em] text-oriwan-text">어드민 접속</h1>
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
                className="w-full rounded-2xl border border-oriwan-border bg-white px-4 py-3 text-center text-lg font-black tracking-[0.25em] outline-none focus:border-oriwan-primary"
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
    <div className="min-h-screen bg-oriwan-bg">
      <header className="sticky top-0 z-50 px-4 py-3 bg-[#101522]/92 backdrop-blur-2xl border-b border-white/10 text-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl overflow-hidden ring-1 ring-white/20 bg-lime-300">
              <Image src="/oriwan-logo-v2.png" alt="어드민" width={36} height={36} className="object-cover" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight leading-none">어드민</h1>
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
        <section className="relative overflow-hidden rounded-[28px] bg-[#101522] p-4 text-white shadow-2xl shadow-slate-950/10">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lime-300/25 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-24 w-72 -translate-x-1/2 rounded-full bg-orange-400/15 blur-3xl" />
          <div className="relative grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => openUploadForDate(effectiveToday)} className="rounded-2xl bg-lime-300 px-4 py-3 text-left text-sm font-black text-slate-950">
              이미지 올리기
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
            </button>
            <button type="button" onClick={() => openManualRecordForDate(effectiveToday)} className="rounded-2xl bg-white/10 px-4 py-3 text-left text-sm font-black text-white ring-1 ring-white/10">
              직접 입력
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

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-black tracking-[-0.03em] text-oriwan-text">스내사 크루별 인증게이지</h2>
            <span className="inline-flex shrink-0 rounded-full bg-lime-300 px-3 py-1 text-[11px] font-black text-slate-950 shadow-sm shadow-lime-300/30">
              멤버 {participants.length}명
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {participantProgress.map((row) => (
              <div key={row.participant.id} className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-950/5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black text-oriwan-text">{row.participant.name}</p>
                  <p className={`shrink-0 text-xs font-black ${gaugeTextClass(row.certifiedDays)}`}>
                    {row.rate}%
                  </p>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-oriwan-surface-light">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${gaugeColorClass(row.certifiedDays)}`}
                    style={{ width: `${Math.max(row.rate, row.certifiedDays ? 3 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
            {!participantProgress.length && !loading && (
              <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-oriwan-text-muted sm:col-span-2 lg:col-span-3">
                멤버가 추가되면 인증게이지가 바로 채워집니다.
              </p>
            )}
          </div>
        </section>

        {adminModal === "upload" && (
          <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:items-center sm:justify-center">
            <div className="card max-h-[88vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.04em] text-oriwan-text">
                    {uploadParticipant ? `${uploadParticipant.name}님 이미지 올리기` : "이미지 올리기"}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-oriwan-text-muted">NRC, Garmin, Strava 캡처에서 날짜, 거리, 시간을 읽어 공통 대시보드에 반영해요.</p>
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
                  날짜가 없을 때 쓸 날짜
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
