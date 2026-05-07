"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/admin";
import { IconCheck } from "@/components/icons";
import { CHALLENGE_END_DATE, CHALLENGE_START_DATE, clampToChallengeWindow } from "@/lib/challenge";
import { parseDurationToSeconds, toIsoDate } from "@/lib/run-records";

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

type AdminOtpType = "email" | "magiclink" | "signup";
type AdminModal = "participant" | "record" | null;
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
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [targetDate, setTargetDate] = useState(initialRecordDate);
  const [manualParticipantId, setManualParticipantId] = useState("");
  const [manualDate, setManualDate] = useState(initialRecordDate);
  const [manualDistance, setManualDistance] = useState("");
  const [manualDuration, setManualDuration] = useState("");
  const [adminBoardFilter, setAdminBoardFilter] = useState<AdminBoardFilter>("all");
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
          <div className="relative grid gap-2">
            <button
              type="button"
              onClick={() => {
                resetParticipantForm();
                setAdminModal("participant");
              }}
              className="rounded-2xl bg-lime-300 px-4 py-3 text-left text-sm font-black text-slate-950"
            >
              멤버 관리
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-oriwan-text">오늘 인증 편집</h2>
                <div className="group relative">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-oriwan-surface-light text-[11px] font-black text-oriwan-text-muted">?</span>
                  <div className="pointer-events-none absolute left-0 top-7 z-10 hidden w-64 rounded-2xl bg-slate-950 p-3 text-[11px] font-bold leading-5 text-white/80 shadow-2xl group-hover:block">
                    공통 대시보드의 인증 상태를 편집하는 영역이에요. 멤버 카드를 누르면 해당 날짜와 멤버로 수동 입력이 바로 열립니다.
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
                onClick={() => openManualRecordForDate(targetDate)}
                className="w-full rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-lime-200 sm:w-auto"
              >
                이 날짜 직접 입력
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
                onClick={() => openManualRecordForDate(targetDate, card.participant.id)}
                title={`${card.participant.name} · ${targetDate} · ${adminBoardStatusLabel(card.status)} · 직접 입력`}
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
