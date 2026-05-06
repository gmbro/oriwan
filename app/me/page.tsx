"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_END_DATE, CHALLENGE_START_DATE, clampToChallengeWindow } from "@/lib/challenge";
import { parseDurationToSeconds, secondsToPace, secondsToTime, toIsoDate } from "@/lib/run-records";

type Participant = {
  id: string;
  name: string;
  nickname: string | null;
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

type MeData = {
  user: { id: string; email?: string };
  runner_name: string;
  matched_participant: Participant | null;
  records: RunRecord[];
  challenge_start_date: string;
};

const today = toIsoDate(new Date());
const initialRecordDate = clampToChallengeWindow(today);

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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
  const [savingName, setSavingName] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [analyzingImages, setAnalyzingImages] = useState(false);

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) {
        setData(null);
        setMessage(json.error || "로그인이 필요합니다.");
        return;
      }
      setData(json);
      setName(json.runner_name || "");
      setMessage("");
    } catch {
      setMessage("개인 대시보드를 불러오지 못했어요.");
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
    setMessage("로그아웃되었습니다.");
  };

  const saveName = async () => {
    if (!name.trim()) {
      setMessage("이름은 필수입니다.");
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
      setMessage(json.matched_participant ? "어드민 참가자명과 연결됐습니다." : "이름을 저장했어요. 어드민 참가자명과 일치하면 기록이 연결됩니다.");
    } else {
      setMessage(json.error || "이름 저장 실패");
    }
    setSavingName(false);
  };

  const saveRecord = async () => {
    const durationSeconds = parseDurationToSeconds(duration);
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
      setMessage("기록이 저장됐습니다.");
      await loadMe();
    } else {
      setMessage(json.error || "기록 저장 실패");
    }
    setSavingRecord(false);
  };

  const analyzeImages = async () => {
    if (!imageFiles.length) {
      setMessage("NRC나 Garmin 같은 러닝 기록 이미지를 선택해주세요.");
      return;
    }

    setAnalyzingImages(true);
    setMessage("");
    try {
      const images = await Promise.all(
        imageFiles.map(async (file) => ({
          name: file.name,
          dataUrl: await readFileAsDataUrl(file),
        }))
      );

      const response = await fetch("/api/me/records/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate: imageDate, images }),
      });
      const json = await response.json();

      if (response.ok) {
        setImageFiles([]);
        setMessage(`${json.results?.length || 1}개 이미지 기록을 저장했습니다.`);
        await loadMe();
      } else {
        setMessage(json.error || "이미지 기록 저장 실패");
      }
    } catch {
      setMessage("이미지를 읽거나 분석하지 못했어요.");
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
          <p className="mt-5 text-xs font-black text-oriwan-primary">PERSONAL DASHBOARD</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.05em] text-oriwan-text">개인 기록 입력</h1>
          <p className="mt-3 text-sm leading-6 text-oriwan-text-muted">
            Google 로그인 후 이름을 등록하면, 어드민 참가자명과 일치할 때 내 인증 기록을 직접 입력하고 볼 수 있습니다.
          </p>
          {message && <p className="mt-4 rounded-2xl bg-oriwan-surface-light px-4 py-3 text-xs font-bold text-oriwan-text-muted">{message}</p>}
          <button onClick={handleGoogleLogin} className="btn-primary mt-6 w-full py-3 text-sm">Google 로그인</button>
          <Link href="/dashboard" className="mt-5 block text-xs font-bold text-oriwan-text-muted hover:text-oriwan-text">전체 대시보드 보기</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-oriwan-bg">
      <header className="sticky top-0 z-50 border-b border-slate-950/10 bg-[#101522]/95 px-4 py-3 text-white backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/oriwan-logo-v2.png" alt="스내사 3기" width={38} height={38} className="rounded-2xl bg-lime-300" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-black tracking-[-0.03em] sm:text-lg">내 인증 대시보드</h1>
              <p className="truncate text-[11px] font-semibold text-white/50">{data.user.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/70 ring-1 ring-white/10 hover:text-white">로그아웃</button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
        <div className="relative overflow-hidden rounded-[30px] bg-[#101522] p-5 text-white shadow-2xl shadow-slate-950/10 sm:p-7">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-lime-300/25 blur-3xl" />
          <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-lime-200 ring-1 ring-white/10">
            인증 기간 · {CERTIFICATION_DISPLAY_START_DATE} ~ {CHALLENGE_END_DATE}
          </p>
          <h2 className="text-4xl font-black tracking-[-0.06em] sm:text-6xl">달린 만큼 쌓이고, 인증한 만큼 선명해져요.</h2>
          <p className="mt-3 text-sm text-white/55">
            {data.matched_participant
              ? `${data.runner_name}님의 기록이 어드민 참가자 데이터와 연결되어 있습니다.`
              : "이름을 저장하면 어드민 참가자명과 일치하는 기록이 자동으로 연결됩니다."}
          </p>
        </div>

        {message && <p className="mt-4 rounded-3xl bg-white px-5 py-4 text-sm font-bold text-oriwan-text-muted ring-1 ring-slate-950/5">{message}</p>}

        <section className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card p-4 sm:p-5">
            <h3 className="text-lg font-black text-oriwan-text">이름 등록</h3>
            <p className="mt-1 text-xs text-oriwan-text-muted">어드민에서 등록한 참가자 이름과 정확히 같아야 합니다.</p>
            <div className="mt-4 flex gap-2">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="이름 필수" className="min-w-0 flex-1 rounded-2xl border border-oriwan-border bg-white px-4 py-3 text-sm font-bold outline-none focus:border-oriwan-primary" />
              <button onClick={saveName} disabled={savingName} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-lime-200 disabled:opacity-50">저장</button>
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <h3 className="text-lg font-black text-oriwan-text">기록 입력</h3>
            <p className="mt-1 text-xs text-oriwan-text-muted">{CHALLENGE_START_DATE}부터 {CHALLENGE_END_DATE}까지 실제 인증 기록만 입력할 수 있습니다.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <input type="date" min={CHALLENGE_START_DATE} max={CHALLENGE_END_DATE} value={recordDate} onChange={(event) => setRecordDate(event.target.value)} className="rounded-2xl border border-oriwan-border bg-white px-3 py-3 text-sm" />
              <input value={distance} onChange={(event) => setDistance(event.target.value)} inputMode="decimal" placeholder="거리 km" className="rounded-2xl border border-oriwan-border bg-white px-3 py-3 text-sm" />
              <input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="시간 32:10" className="rounded-2xl border border-oriwan-border bg-white px-3 py-3 text-sm" />
            </div>
            <button onClick={saveRecord} disabled={savingRecord || !data.matched_participant} className="btn-primary mt-3 w-full py-3 text-sm disabled:opacity-40">
              {savingRecord ? "저장 중..." : "내 기록 저장"}
            </button>

            <div className="mt-5 rounded-[26px] bg-oriwan-surface-light p-4 ring-1 ring-slate-950/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-oriwan-text">러닝 앱 이미지로 등록</h4>
                  <p className="mt-1 text-xs leading-5 text-oriwan-text-muted">
                    NRC, Garmin, Strava 등 스크린샷에서 날짜, 거리, 시간을 자동 추출합니다.
                  </p>
                </div>
                <span className="rounded-full bg-lime-200 px-3 py-1 text-[10px] font-black text-slate-950">OCR</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[0.72fr_1.28fr]">
                <input
                  type="date"
                  min={CHALLENGE_START_DATE}
                  max={CHALLENGE_END_DATE}
                  value={imageDate}
                  onChange={(event) => setImageDate(event.target.value)}
                  className="rounded-2xl border border-oriwan-border bg-white px-3 py-3 text-sm"
                />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setImageFiles(Array.from(event.target.files || []))}
                  className="rounded-2xl border border-oriwan-border bg-white px-3 py-2.5 text-xs text-oriwan-text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-black file:text-lime-200"
                />
              </div>
              <p className="mt-2 text-[11px] text-oriwan-text-muted">
                이미지에 날짜가 없으면 왼쪽 선택일로 저장되고, 거리나 시간이 안 보이면 직접 입력으로 보완할 수 있어요.
              </p>
              <button onClick={analyzeImages} disabled={analyzingImages || !data.matched_participant || !imageFiles.length} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-lime-200 disabled:opacity-40">
                {analyzingImages ? "이미지 분석 중..." : `이미지 기록 저장${imageFiles.length ? ` (${imageFiles.length})` : ""}`}
              </button>
            </div>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric title="오늘 거리" value={`${stats.todayDistance.toFixed(1)}km`} />
          <Metric title="오늘 시간" value={secondsToTime(stats.todayTime)} />
          <Metric title="누적 거리" value={`${stats.totalDistance.toFixed(1)}km`} />
          <Metric title="누적 시간" value={secondsToTime(stats.totalTime)} />
        </div>

        <section className="mt-4 card p-4 sm:p-5">
          <h3 className="text-lg font-black text-oriwan-text">내 인증 기록</h3>
          <div className="mt-4 space-y-2">
            {stats.records.map((record) => (
              <div key={record.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-3xl bg-oriwan-surface-light p-3">
                <div>
                  <p className="text-sm font-black text-oriwan-text">{record.record_date || "날짜 없음"}</p>
                  <p className="text-[11px] text-oriwan-text-muted">{(record.distance_km || 0).toFixed(1)}km · {secondsToTime(record.duration_seconds)} · {secondsToPace(record.pace_seconds_per_km)}</p>
                </div>
                <span className="rounded-full bg-lime-300 px-3 py-1 text-[10px] font-black text-slate-950">인증</span>
              </div>
            ))}
            {!stats.records.length && <p className="py-8 text-center text-sm text-oriwan-text-muted">아직 내 기록이 없습니다.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-oriwan-text-muted">{title}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-oriwan-text sm:text-3xl">{value}</p>
    </div>
  );
}
