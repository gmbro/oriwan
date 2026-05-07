"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CHALLENGE_START_DATE, clampToChallengeWindow } from "@/lib/challenge";
import { broadcastDashboardRefresh } from "@/lib/dashboard-refresh";
import { imageFileToOptimizedDataUrl } from "@/lib/image-client";
import { parseDurationToSeconds, secondsToPace, secondsToTime, toIsoDate } from "@/lib/run-records";

type Participant = {
  id: string;
  name: string;
};

type RunRecord = {
  id: string;
  record_date: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  pace_seconds_per_km: number | null;
  status: string;
  source_app: string | null;
  notes: string | null;
};

type ImageAnalyzeResult = {
  id: string;
  record_date: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  pace_seconds_per_km: number | null;
  source_app: string | null;
  confidence_score: number | null;
  date_was_fallback?: boolean;
  file_name?: string | null;
};

type ImageAnalyzeFailure = {
  file_name?: string | null;
  error: string;
  extracted?: {
    record_date?: string | null;
    distance_km?: number | string | null;
    duration_text?: string | null;
    duration_seconds?: number | string | null;
    source_app?: string | null;
  };
};

type MeData = {
  user: { id: string; email?: string };
  runner_name: string;
  matched_participant: Participant | null;
  records: RunRecord[];
  challenge_start_date: string;
};

const today = toIsoDate(new Date());
const initialRecordDate = clampToChallengeWindow(today);
const IMAGE_UPLOAD_CHUNK_SIZE = 5;

export default function MyPage() {
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [recordDate, setRecordDate] = useState(initialRecordDate);
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [imageDate, setImageDate] = useState(initialRecordDate);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [useFallbackImageDate, setUseFallbackImageDate] = useState(false);
  const [imageResults, setImageResults] = useState<ImageAnalyzeResult[]>([]);
  const [imageFailures, setImageFailures] = useState<ImageAnalyzeFailure[]>([]);
  const [savingName, setSavingName] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [analyzingImages, setAnalyzingImages] = useState(false);

  const loadMe = useCallback(async (preserveMessage = false) => {
    setLoading(true);
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) {
        setData(null);
        setMessage(json.error || "내 기록을 올리려면 먼저 로그인해주세요.");
        return;
      }
      setData(json);
      setName(json.runner_name || "");
      if (!preserveMessage) setMessage("");
    } catch {
      setMessage("내 러닝 보드를 불러오지 못했어요. 잠시 후 다시 열어볼게요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const stats = useMemo(() => {
    const records = data?.records || [];
    const todayRecords = records.filter((record) => record.record_date === today && record.status === "certified");
    const todayDistance = todayRecords.reduce((sum, record) => sum + (record.distance_km || 0), 0);
    const todayTime = todayRecords.reduce((sum, record) => sum + (record.duration_seconds || 0), 0);
    const totalDistance = records.reduce((sum, record) => sum + (record.distance_km || 0), 0);
    const totalTime = records.reduce((sum, record) => sum + (record.duration_seconds || 0), 0);

    return { records, todayDistance, todayTime, totalDistance, totalTime };
  }, [data?.records]);

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/me`,
      },
    });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setData(null);
    setMessage("로그아웃됐어요. 오늘도 좋은 러닝이었어요.");
  };

  const saveName = async () => {
    if (!name.trim()) {
      setMessage("기록을 연결하려면 이름이 꼭 필요해요.");
      return;
    }
    setSavingName(true);
    setMessage("");
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runner_name: name }),
    });
    const json = await response.json();
    if (response.ok) {
      setData(json);
      setMessage(json.matched_participant ? "좋아요. 멤버 이름과 연결됐어요." : "이름을 저장했어요. 어드민에 등록된 이름과 같으면 기록이 바로 이어집니다.");
    } else {
      setMessage(json.error || "이름을 저장하지 못했어요. 다시 한 번만 시도해주세요.");
    }
    setSavingName(false);
  };

  const saveRecord = async () => {
    const durationSeconds = parseDurationToSeconds(duration);
    if (!distance.trim() && !durationSeconds) {
      setMessage("거리 또는 시간 중 하나만 있어도 좋아요. 하나만 입력해도 인증됩니다.");
      return;
    }
    setSavingRecord(true);
    setMessage("");
    const response = await fetch("/api/me/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record_date: recordDate,
        distance_km: distance,
        duration_seconds: durationSeconds,
      }),
    });
    const json = await response.json();
    if (response.ok) {
      setDistance("");
      setDuration("");
      setMessage("기록 저장 완료. 어드민과 팀 보드에도 바로 반영돼요.");
      void broadcastDashboardRefresh();
      await loadMe(true);
    } else {
      setMessage(json.error || "기록을 저장하지 못했어요. 거리 또는 시간을 다시 확인해주세요.");
    }
    setSavingRecord(false);
  };

  const analyzeImages = async () => {
    if (!imageFiles.length) {
      setMessage("NRC나 Garmin 같은 러닝 기록 이미지를 먼저 선택해주세요.");
      return;
    }

    setAnalyzingImages(true);
    setMessage("");
    setImageResults([]);
    setImageFailures([]);
    try {
      const savedResults: ImageAnalyzeResult[] = [];
      const failedResults: ImageAnalyzeFailure[] = [];

      for (let index = 0; index < imageFiles.length; index += IMAGE_UPLOAD_CHUNK_SIZE) {
        const chunk = imageFiles.slice(index, index + IMAGE_UPLOAD_CHUNK_SIZE);
        const images = await Promise.all(
          chunk.map(async (file) => ({
            name: file.name,
            dataUrl: await imageFileToOptimizedDataUrl(file),
          }))
        );

        const response = await fetch("/api/me/records/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetDate: useFallbackImageDate ? imageDate : null, images }),
        });
        const json = await response.json();

        if (Array.isArray(json.results)) savedResults.push(...json.results);
        if (Array.isArray(json.failed)) failedResults.push(...json.failed);
        if (!response.ok && !Array.isArray(json.failed)) {
          failedResults.push(...chunk.map((file) => ({ file_name: file.name, error: json.error || "이미지 기록을 저장하지 못했어요." })));
        }
      }

      setImageResults(savedResults);
      setImageFailures(failedResults);
      setImageFiles([]);

      if (savedResults.length) {
        setMessage(`${savedResults.length}개 이미지 기록을 저장했어요. 팀 보드에도 바로 이어졌습니다.${failedResults.length ? ` ${failedResults.length}개는 한 번만 확인해주세요.` : ""}`);
        void broadcastDashboardRefresh();
        await loadMe(true);
      } else {
        setMessage(failedResults[0]?.error || "저장된 이미지 기록이 없어요. 날짜, 거리, 시간이 잘 보이는 이미지로 다시 시도해주세요.");
      }
    } catch {
      setMessage("이미지를 읽지 못했어요. 화면이 선명한지 한 번만 확인해주세요.");
    } finally {
      setAnalyzingImages(false);
    }
  };

  if (loading) return <main className="min-h-screen bg-oriwan-bg" />;

  if (!data) {
    return (
      <main className="min-h-screen bg-oriwan-bg px-5 py-8 flex items-center justify-center">
        <div className="card w-full max-w-[430px] p-7 text-center sm:p-9">
          <Image src="/oriwan-logo-v2.png" alt="스내사 3기" width={72} height={72} className="mx-auto rounded-3xl" />
          <p className="mt-5 text-xs font-black text-oriwan-primary">MY RUNNING BOARD</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.05em] text-oriwan-text">내 러닝 기록 올리기</h1>
          <p className="mt-3 text-sm leading-6 text-oriwan-text-muted">
            Google로 로그인하고, 어드민에 등록된 이름과 똑같이 입력해주세요. 이름이 맞으면 내 러닝 기록이 자동으로 이어집니다.
          </p>
          {message && <p className="mt-4 rounded-2xl bg-oriwan-surface-light px-4 py-3 text-xs font-bold text-oriwan-text-muted">{message}</p>}
          <button onClick={handleGoogleLogin} className="btn-primary mt-6 w-full py-3 text-sm">Google 로그인</button>
          <Link href="/dashboard" className="mt-5 block text-xs font-bold text-oriwan-text-muted hover:text-oriwan-text">팀 인증 보러가기</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-oriwan-bg">
      <header className="sticky top-0 z-50 border-b border-slate-950/10 bg-[#101522]/95 px-4 py-3 text-white backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/oriwan-logo-v2.png" alt="스내사 3기" width={38} height={38} className="rounded-2xl bg-lime-300" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-black tracking-[-0.03em] sm:text-lg">내 러닝 보드</h1>
              <p className="truncate text-[11px] font-semibold text-white/50">{data.user.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="shrink-0 rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/70 ring-1 ring-white/10 hover:text-white">로그아웃</button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl overflow-hidden px-3 py-4 sm:px-4 sm:py-6">
        {message && <p className="rounded-3xl bg-white px-5 py-4 text-sm font-bold text-oriwan-text-muted ring-1 ring-slate-950/5">{message}</p>}

        <section className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card min-w-0 overflow-hidden p-4 sm:p-5">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-oriwan-text">이름 연결하기</h3>
                <p className="mt-1 text-xs leading-5 text-oriwan-text-muted">어드민에 등록된 이름과 띄어쓰기까지 똑같이 입력하면 기록이 착 붙어요.</p>
              </div>
              <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${data.matched_participant ? "bg-lime-200 text-slate-950" : "bg-amber-100 text-amber-800"}`}>
                {data.matched_participant ? "연결 완료" : "이름 연결 전"}
              </span>
            </div>
            <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-[1fr_auto]">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 등록된 이름 그대로" className="w-full min-w-0 rounded-2xl border border-oriwan-border bg-white px-4 py-3 text-sm font-bold outline-none focus:border-oriwan-primary" />
              <button onClick={saveName} disabled={savingName} className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-lime-200 disabled:opacity-50 sm:w-auto">저장</button>
            </div>
            {!data.matched_participant && (
              <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold leading-5 text-amber-800 ring-1 ring-amber-100">
                이름이 연결되면 직접 입력한 기록과 이미지 기록을 바로 저장할 수 있어요. 예: 등록 이름이 “김지우”라면 “김지우”로 입력해주세요.
              </p>
            )}
          </div>

          <div className="card min-w-0 overflow-hidden p-4 sm:p-5">
            <h3 className="text-lg font-black text-oriwan-text">오늘의 러닝 남기기</h3>
            <p className="mt-1 text-xs text-oriwan-text-muted">{CHALLENGE_START_DATE}부터 쭉 러닝 기록을 남길 수 있어요.</p>
            <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-3">
              <input type="date" min={CHALLENGE_START_DATE} value={recordDate} onChange={(event) => setRecordDate(event.target.value)} className="w-full min-w-0 rounded-2xl border border-oriwan-border bg-white px-3 py-3 text-sm" />
              <input value={distance} onChange={(event) => setDistance(event.target.value)} inputMode="decimal" placeholder="거리 km" className="w-full min-w-0 rounded-2xl border border-oriwan-border bg-white px-3 py-3 text-sm" />
              <input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="시간 32:10" className="w-full min-w-0 rounded-2xl border border-oriwan-border bg-white px-3 py-3 text-sm" />
            </div>
            <button onClick={saveRecord} disabled={savingRecord || !data.matched_participant} className="btn-primary mt-3 w-full py-3 text-sm disabled:opacity-40">
              {savingRecord ? "기록 쌓는 중..." : data.matched_participant ? "내 기록 저장하기" : "이름 연결 후 저장 가능"}
            </button>

            <div className="mt-5 min-w-0 rounded-[26px] bg-oriwan-surface-light p-4 ring-1 ring-slate-950/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-oriwan-text">러닝 앱 이미지 한 번에 올리기</h4>
                  <p className="mt-1 text-xs leading-5 text-oriwan-text-muted">
                    NRC, Garmin, Strava 스크린샷 여러 장에서 날짜, 거리, 시간을 가볍게 읽어옵니다.
                  </p>
                </div>
                <span className="rounded-full bg-lime-200 px-3 py-1 text-[10px] font-black text-slate-950">일괄 OCR</span>
              </div>
              <div className="mt-4 rounded-[22px] border border-dashed border-lime-400/80 bg-white/60 p-3">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-white px-4 py-5 text-center ring-1 ring-slate-950/5">
                  <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-lime-200">이미지 여러 장 선택</span>
                  <span className="max-w-full truncate text-xs font-bold text-oriwan-text-muted">
                    {imageFiles.length ? `${imageFiles.length}장 선택됨` : "카카오톡에서 저장한 러닝 이미지를 한 번에 골라주세요"}
                  </span>
                  <span className="text-[11px] text-oriwan-text-muted">날짜가 보이면 그 날짜로 알아서 저장해요.</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => setImageFiles(Array.from(event.target.files || []))}
                    className="sr-only"
                  />
                </label>
                {imageFiles.length > 0 && (
                  <div className="mt-3 max-h-28 space-y-1 overflow-y-auto rounded-2xl bg-oriwan-surface-light p-2">
                    {imageFiles.map((file) => (
                      <p key={`${file.name}-${file.lastModified}`} className="truncate text-[11px] font-bold text-oriwan-text-muted">{file.name}</p>
                    ))}
                  </div>
                )}
              </div>
              <label className="mt-3 flex items-start gap-2 rounded-2xl bg-white px-3 py-3 text-xs font-bold text-oriwan-text-muted ring-1 ring-slate-950/5">
                <input
                  type="checkbox"
                  checked={useFallbackImageDate}
                  onChange={(event) => setUseFallbackImageDate(event.target.checked)}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  이미지에 날짜가 없을 때만 아래 날짜로 저장
                  <input
                    type="date"
                    min={CHALLENGE_START_DATE}
                    value={imageDate}
                    onChange={(event) => setImageDate(event.target.value)}
                    disabled={!useFallbackImageDate}
                    className="mt-2 w-full rounded-2xl border border-oriwan-border bg-white px-3 py-3 text-sm font-black text-oriwan-text disabled:opacity-50"
                  />
                </span>
              </label>
              {!data.matched_participant && (
                <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold leading-5 text-amber-800 ring-1 ring-amber-100">
                  이름이 연결되면 이미지 기록도 바로 저장할 수 있어요.
                </p>
              )}
              <button onClick={analyzeImages} disabled={analyzingImages || !data.matched_participant || !imageFiles.length} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-lime-200 disabled:opacity-40">
                {analyzingImages ? "이미지 읽는 중..." : data.matched_participant ? `한 번에 등록하기${imageFiles.length ? ` (${imageFiles.length})` : ""}` : "이름 연결 후 등록 가능"}
              </button>
            </div>
          </div>
        </section>

        {(imageResults.length > 0 || imageFailures.length > 0) && (
          <section className="mt-4 card min-w-0 overflow-hidden p-4 sm:p-5">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-oriwan-text">이미지 등록 결과</h3>
                <p className="mt-1 text-xs text-oriwan-text-muted">저장된 기록은 내 기록과 팀 보드에 바로 반영돼요.</p>
              </div>
              <span className="w-fit shrink-0 rounded-full bg-lime-200 px-3 py-1 text-[10px] font-black text-slate-950">{imageResults.length}개 저장</span>
            </div>
            <div className="mt-4 space-y-2">
              {imageResults.map((result) => (
                <div key={result.id} className="min-w-0 rounded-3xl bg-white p-3 ring-1 ring-slate-950/5">
                  <p className="truncate text-sm font-black text-oriwan-text">{result.record_date || "날짜 없음"} · {(result.distance_km || 0).toFixed(2)}km</p>
                  <p className="mt-1 truncate text-[11px] text-oriwan-text-muted">
                    {secondsToTime(result.duration_seconds)} · {secondsToPace(result.pace_seconds_per_km)} · {result.source_app || "러닝 앱 이미지"}
                    {result.date_was_fallback ? " · 선택일 적용" : ""}
                  </p>
                </div>
              ))}
              {imageFailures.map((failure, index) => (
                <div key={`${failure.file_name}-${index}`} className="min-w-0 rounded-3xl bg-rose-50 p-3 ring-1 ring-rose-100">
                  <p className="truncate text-sm font-black text-rose-700">{failure.file_name || "이미지"} 한 번 더 확인해주세요</p>
                  <p className="mt-1 text-[11px] font-bold leading-5 text-rose-700/70">{failure.error}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric title="오늘 거리" value={`${stats.todayDistance.toFixed(1)}km`} />
          <Metric title="오늘 시간" value={secondsToTime(stats.todayTime)} />
          <Metric title="누적 거리" value={`${stats.totalDistance.toFixed(1)}km`} />
          <Metric title="누적 시간" value={secondsToTime(stats.totalTime)} />
        </div>

        <section className="mt-4 card min-w-0 overflow-hidden p-4 sm:p-5">
          <h3 className="text-lg font-black text-oriwan-text">내가 쌓은 러닝</h3>
          <div className="mt-4 space-y-2">
            {stats.records.map((record) => (
              <div key={record.id} className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-3 rounded-3xl bg-oriwan-surface-light p-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-oriwan-text">{record.record_date || "날짜 없음"}</p>
                  <p className="truncate text-[11px] text-oriwan-text-muted">{(record.distance_km || 0).toFixed(1)}km · {secondsToTime(record.duration_seconds)} · {secondsToPace(record.pace_seconds_per_km)}</p>
                </div>
                <span className="rounded-full bg-lime-300 px-3 py-1 text-[10px] font-black text-slate-950">인증</span>
              </div>
            ))}
            {!stats.records.length && <p className="py-8 text-center text-sm text-oriwan-text-muted">아직 기록이 없어요. 첫 러닝을 가볍게 남겨볼까요?</p>}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="card min-w-0 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-oriwan-text-muted">{title}</p>
      <p className="mt-2 truncate text-2xl font-black tracking-[-0.05em] text-oriwan-text sm:text-3xl">{value}</p>
    </div>
  );
}
