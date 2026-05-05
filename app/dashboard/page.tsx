"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { IconCheck, IconRun, IconSprout } from "@/components/icons";
import { addDays, parseDurationToSeconds, secondsToPace, secondsToTime, toIsoDate } from "@/lib/run-records";

type Participant = {
  id: string;
  name: string;
  nickname: string | null;
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
  participants?: { id: string; name: string; nickname: string | null } | null;
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

type RankingMode = "certified" | "distance" | "time";

const today = toIsoDate(new Date());
const rangeStart = toIsoDate(addDays(new Date(), -20));
const timelineDays = Array.from({ length: 14 }, (_, index) => toIsoDate(addDays(new Date(), index - 13)));

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function statusLabel(status: RecordStatus) {
  if (status === "certified") return "인증";
  if (status === "needs_review") return "확인 필요";
  if (status === "rejected") return "반려";
  return "미제출";
}

function statusClass(status: RecordStatus) {
  if (status === "certified") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "needs_review") return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "rejected") return "bg-rose-50 text-rose-700 border-rose-100";
  return "bg-slate-50 text-slate-400 border-slate-100";
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

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RecordDraft>>({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [targetDate, setTargetDate] = useState(today);
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [manualParticipantId, setManualParticipantId] = useState("");
  const [manualDate, setManualDate] = useState(today);
  const [manualDistance, setManualDistance] = useState("");
  const [manualDuration, setManualDuration] = useState("");
  const [rankingMode, setRankingMode] = useState<RankingMode>("certified");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [participantsRes, recordsRes] = await Promise.all([
        fetch("/api/participants", { cache: "no-store" }),
        fetch(`/api/records?from=${rangeStart}&to=${today}`, { cache: "no-store" }),
      ]);

      const participantsJson = await participantsRes.json();
      const recordsJson = await recordsRes.json();
      const nextParticipants = participantsJson.participants || [];
      const nextRecords = recordsJson.records || [];

      setParticipants(nextParticipants);
      setRecords(nextRecords);
      setSelectedParticipantId((current) => current || nextParticipants[0]?.id || "");
      setManualParticipantId((current) => current || nextParticipants[0]?.id || "");
      setDrafts(Object.fromEntries(nextRecords.map((record: RunRecord) => [record.id, makeDraft(record)])));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setUserName(user.user_metadata?.full_name || user.email?.split("@")[0] || "운영자");
      setUserAvatar(user.user_metadata?.avatar_url || "");
      await loadData();
    };
    init();
  }, [loadData, router]);

  const todayRecords = useMemo(() => records.filter((record) => record.record_date === targetDate), [records, targetDate]);
  const certifiedToday = useMemo(() => todayRecords.filter((record) => record.status === "certified").length, [todayRecords]);
  const needsReview = useMemo(() => records.filter((record) => record.status === "needs_review").length, [records]);
  const totalDistance = useMemo(() => todayRecords.reduce((sum, record) => sum + (record.distance_km || 0), 0), [todayRecords]);
  const totalTime = useMemo(() => todayRecords.reduce((sum, record) => sum + (record.duration_seconds || 0), 0), [todayRecords]);

  const recordsByParticipantDate = useMemo(() => {
    const map = new Map<string, RunRecord>();
    records.forEach((record) => {
      if (record.participant_id && record.record_date) {
        map.set(`${record.participant_id}:${record.record_date}`, record);
      }
    });
    return map;
  }, [records]);

  const rankings = useMemo(() => {
    const rows = participants.map((participant) => {
      const participantRecords = records.filter((record) => record.participant_id === participant.id && record.status === "certified");
      return {
        participant,
        certifiedCount: participantRecords.length,
        distance: participantRecords.reduce((sum, record) => sum + (record.distance_km || 0), 0),
        time: participantRecords.reduce((sum, record) => sum + (record.duration_seconds || 0), 0),
      };
    });

    return rows.sort((a, b) => {
      if (rankingMode === "distance") return b.distance - a.distance;
      if (rankingMode === "time") return b.time - a.time;
      return b.certifiedCount - a.certifiedCount || b.distance - a.distance;
    });
  }, [participants, rankingMode, records]);

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
      body: JSON.stringify({ name: newName, nickname: newNickname }),
    });
    if (res.ok) {
      setNewName("");
      setNewNickname("");
      await loadData();
    } else {
      alert("참가자를 저장하지 못했어요.");
    }
  }, [loadData, newName, newNickname]);

  const analyzeImages = useCallback(async () => {
    if (!files.length) return;
    setAnalyzing(true);
    try {
      const images = await Promise.all(files.map(async (file) => ({ name: file.name, dataUrl: await readFileAsDataUrl(file) })));
      const res = await fetch("/api/records/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate, images }),
      });
      if (!res.ok) throw new Error("analysis failed");
      setFiles([]);
      await loadData();
    } catch {
      alert("이미지 분석에 실패했어요. 흐린 이미지는 직접 입력으로 등록해주세요.");
    } finally {
      setAnalyzing(false);
    }
  }, [files, loadData, targetDate]);

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
        notes: duration ? null : "시간 수동 입력 필요",
      }),
    });
    if (res.ok) {
      setManualDistance("");
      setManualDuration("");
      await loadData();
    } else {
      alert("기록 저장에 실패했어요.");
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
    else alert("수정 저장에 실패했어요.");
  }, [drafts, loadData]);

  const handleLogout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST" }).then(() => { router.push("/"); router.refresh(); });
  }, [router]);

  if (!mounted) return <div className="min-h-screen bg-oriwan-bg" />;

  return (
    <div className="min-h-screen bg-oriwan-bg">
      <header className="sticky top-0 z-50 px-4 py-3 bg-oriwan-bg/90 backdrop-blur-xl border-b border-oriwan-border/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl overflow-hidden">
              <Image src="/oriwan-logo-v2.png" alt="오리완" width={32} height={32} className="object-cover" />
            </div>
            <div>
              <h1 className="text-base font-black gradient-text leading-none">오리완 운영 대시보드</h1>
              <p className="text-[11px] text-oriwan-text-muted mt-1">이미지 기반 러닝 인증 관리</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {userAvatar && <img src={userAvatar} alt="" width={28} height={28} className="rounded-full border border-oriwan-border" />}
            <span className="hidden sm:inline text-xs font-semibold text-oriwan-text-muted">{userName}</span>
            <button onClick={handleLogout} className="text-xs text-oriwan-text-muted hover:text-oriwan-text transition-colors font-medium">로그아웃</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5 pb-12">
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <SummaryCard title="참가자" value={`${participants.length}명`} caption="직접 추가/관리" />
          <SummaryCard title="선택일 인증" value={`${certifiedToday}/${participants.length}`} caption={targetDate} />
          <SummaryCard title="확인 필요" value={`${needsReview}건`} caption="날짜/시간/이름 검수" tone="amber" />
          <SummaryCard title="선택일 거리" value={`${totalDistance.toFixed(1)}km`} caption="인증 완료 기준" />
          <SummaryCard title="선택일 시간" value={secondsToTime(totalTime)} caption="누적 러닝 시간" />
        </section>

        <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
          <div className="card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-oriwan-text">이미지 업로드 분석</h2>
                <p className="text-xs text-oriwan-text-muted mt-1">배경은 무시하고 텍스트/숫자만 추출합니다. 날짜가 없으면 아래 날짜를 임시 적용하고 확인 필요로 남겨요.</p>
              </div>
              <label className="text-xs font-bold text-oriwan-text-muted">
                기본 날짜
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="block mt-1 rounded-xl border border-oriwan-border px-3 py-2 text-sm text-oriwan-text bg-white" />
              </label>
            </div>
            <div className="rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-5 text-center">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="mx-auto block text-sm text-oriwan-text-muted file:mr-4 file:rounded-xl file:border-0 file:bg-oriwan-primary file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
              />
              <p className="text-xs text-oriwan-text-muted mt-3">선택됨: {files.length}장</p>
              <button onClick={analyzeImages} disabled={!files.length || analyzing} className="btn-primary mt-4 px-5 py-3 text-sm disabled:opacity-40">
                {analyzing ? "이미지 분석 중..." : "업로드하고 자동 추출"}
              </button>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-black text-oriwan-text">참가자 추가</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="이름" className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
              <input value={newNickname} onChange={(e) => setNewNickname(e.target.value)} placeholder="닉네임 또는 앱 이름" className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
            </div>
            <button onClick={addParticipant} className="btn-primary w-full py-3 text-sm">참가자 등록</button>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {participants.map((participant) => (
                <span key={participant.id} className="rounded-full bg-oriwan-surface-light px-3 py-1.5 text-xs font-bold text-oriwan-text">
                  {participant.name}{participant.nickname ? ` · ${participant.nickname}` : ""}
                </span>
              ))}
              {!participants.length && <p className="text-xs text-oriwan-text-muted">먼저 참가자 이름을 등록해주세요.</p>}
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-5">
          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-black text-oriwan-text">수동 기록 입력</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              <select value={manualParticipantId} onChange={(e) => setManualParticipantId(e.target.value)} className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm bg-white">
                <option value="">참가자 선택</option>
                {participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}
              </select>
              <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
              <input value={manualDistance} onChange={(e) => setManualDistance(e.target.value)} placeholder="거리 km" inputMode="decimal" className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
              <input value={manualDuration} onChange={(e) => setManualDuration(e.target.value)} placeholder="시간 예: 32:10" className="rounded-xl border border-oriwan-border px-3 py-2.5 text-sm" />
            </div>
            <button onClick={saveManualRecord} className="btn-primary w-full py-3 text-sm">수동 기록 저장</button>
          </div>

          <div className="card p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-oriwan-text">인증 시계열</h2>
                <p className="text-xs text-oriwan-text-muted mt-1">최근 14일 인증 여부를 한눈에 봅니다.</p>
              </div>
              <IconSprout size={22} className="text-oriwan-primary" />
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[720px] space-y-2">
                <div className="grid grid-cols-[120px_repeat(14,1fr)] gap-1 text-[10px] font-bold text-oriwan-text-muted">
                  <div>참가자</div>
                  {timelineDays.map((day) => <div key={day} className="text-center">{day.slice(5).replace("-", "/")}</div>)}
                </div>
                {participants.map((participant) => (
                  <div key={participant.id} className="grid grid-cols-[120px_repeat(14,1fr)] gap-1 items-center">
                    <div className="truncate text-xs font-bold text-oriwan-text">{participant.name}</div>
                    {timelineDays.map((day) => {
                      const record = recordsByParticipantDate.get(`${participant.id}:${day}`);
                      const status = record?.status || "missing";
                      return <div key={day} title={statusLabel(status)} className={`h-8 rounded-lg border flex items-center justify-center text-[11px] font-black ${statusClass(status)}`}>{status === "certified" ? <IconCheck size={13} /> : status === "needs_review" ? "!" : "·"}</div>;
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-5">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-black text-oriwan-text">랭킹</h2>
              <div className="flex rounded-xl bg-oriwan-surface-light p-1 text-xs font-bold">
                {(["certified", "distance", "time"] as RankingMode[]).map((mode) => (
                  <button key={mode} onClick={() => setRankingMode(mode)} className={`rounded-lg px-3 py-1.5 ${rankingMode === mode ? "bg-white text-oriwan-primary shadow-sm" : "text-oriwan-text-muted"}`}>
                    {mode === "certified" ? "인증" : mode === "distance" ? "거리" : "시간"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {rankings.map((row, index) => (
                <div key={row.participant.id} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-2xl bg-oriwan-surface-light px-3 py-3">
                  <div className="text-sm font-black text-oriwan-primary">{index + 1}</div>
                  <div>
                    <p className="text-sm font-bold text-oriwan-text">{row.participant.name}</p>
                    <p className="text-[11px] text-oriwan-text-muted">인증 {row.certifiedCount}회 · {row.distance.toFixed(1)}km · {secondsToTime(row.time)}</p>
                  </div>
                  <IconRun size={18} className="text-oriwan-primary" />
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-black text-oriwan-text">개인별 거리/시간 그래프</h2>
                <p className="text-xs text-oriwan-text-muted mt-1">파란 선은 거리, 초록 선은 시간입니다.</p>
              </div>
              <select value={selectedParticipantId} onChange={(e) => setSelectedParticipantId(e.target.value)} className="rounded-xl border border-oriwan-border px-3 py-2 text-sm bg-white">
                {participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}
              </select>
            </div>
            <div className="rounded-3xl bg-slate-950 p-4 overflow-hidden">
              {selectedSeries.length ? (
                <svg viewBox={`0 0 ${graph.width} ${graph.height}`} className="w-full h-48">
                  <line x1="18" y1="110" x2="302" y2="110" stroke="rgba(255,255,255,.16)" />
                  <polyline fill="none" stroke="#60A5FA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={polyline(graph.distancePoints)} />
                  <polyline fill="none" stroke="#34D399" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={polyline(graph.timePoints)} />
                  {graph.distancePoints.map((point, index) => <circle key={`d${index}`} cx={point.x} cy={point.y} r="4" fill="#BFDBFE" />)}
                </svg>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-white/50">기록이 생기면 그래프가 표시됩니다.</div>
              )}
            </div>
          </div>
        </section>

        <section className="card p-5 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-oriwan-text">기록 검수</h2>
              <p className="text-xs text-oriwan-text-muted mt-1">이미지에서 시간이 없거나 날짜가 없으면 여기서 직접 수정해 인증 처리합니다.</p>
            </div>
            <button onClick={loadData} className="rounded-xl bg-oriwan-surface-light px-3 py-2 text-xs font-bold text-oriwan-text-muted">새로고침</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-xs">
              <thead className="text-oriwan-text-muted">
                <tr className="border-b border-oriwan-border">
                  <th className="py-2 pr-2">상태</th>
                  <th className="py-2 pr-2">참가자</th>
                  <th className="py-2 pr-2">날짜</th>
                  <th className="py-2 pr-2">거리</th>
                  <th className="py-2 pr-2">시간</th>
                  <th className="py-2 pr-2">페이스</th>
                  <th className="py-2 pr-2">출처</th>
                  <th className="py-2 pr-2">메모</th>
                  <th className="py-2 pr-2">저장</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const draft = drafts[record.id] || makeDraft(record);
                  return (
                    <tr key={record.id} className="border-b border-oriwan-border/60 align-top">
                      <td className="py-2 pr-2">
                        <select value={draft.status} onChange={(e) => updateDraft(record.id, { status: e.target.value as RecordStatus })} className={`rounded-lg border px-2 py-1.5 font-bold ${statusClass(draft.status)}`}>
                          <option value="certified">인증</option>
                          <option value="needs_review">확인 필요</option>
                          <option value="rejected">반려</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <select value={draft.participant_id} onChange={(e) => updateDraft(record.id, { participant_id: e.target.value })} className="w-28 rounded-lg border border-oriwan-border px-2 py-1.5 bg-white">
                          <option value="">미매칭</option>
                          {participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-2"><input type="date" value={draft.record_date} onChange={(e) => updateDraft(record.id, { record_date: e.target.value })} className="rounded-lg border border-oriwan-border px-2 py-1.5" /></td>
                      <td className="py-2 pr-2"><input value={draft.distance_km} onChange={(e) => updateDraft(record.id, { distance_km: e.target.value })} className="w-20 rounded-lg border border-oriwan-border px-2 py-1.5" /></td>
                      <td className="py-2 pr-2"><input value={draft.duration} onChange={(e) => updateDraft(record.id, { duration: e.target.value })} placeholder="32:10" className="w-20 rounded-lg border border-oriwan-border px-2 py-1.5" /></td>
                      <td className="py-2 pr-2 font-bold text-oriwan-primary">{secondsToPace(record.pace_seconds_per_km)}</td>
                      <td className="py-2 pr-2"><input value={draft.source_app} onChange={(e) => updateDraft(record.id, { source_app: e.target.value })} className="w-24 rounded-lg border border-oriwan-border px-2 py-1.5" /></td>
                      <td className="py-2 pr-2"><input value={draft.notes} onChange={(e) => updateDraft(record.id, { notes: e.target.value })} className="w-56 rounded-lg border border-oriwan-border px-2 py-1.5" /></td>
                      <td className="py-2 pr-2"><button onClick={() => saveDraft(record.id)} className="rounded-lg bg-oriwan-primary px-3 py-1.5 font-bold text-white">저장</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!records.length && !loading && <p className="py-10 text-center text-sm text-oriwan-text-muted">아직 기록이 없습니다. 이미지를 업로드하거나 수동으로 입력해주세요.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ title, value, caption, tone = "blue" }: { title: string; value: string; caption: string; tone?: "blue" | "amber" }) {
  return (
    <div className={`card p-4 ${tone === "amber" ? "bg-amber-50/60" : ""}`}>
      <p className="text-[11px] font-bold text-oriwan-text-muted mb-1">{title}</p>
      <p className="text-2xl font-black text-oriwan-text tracking-tight">{value}</p>
      <p className="text-[11px] text-oriwan-text-muted mt-1">{caption}</p>
    </div>
  );
}
