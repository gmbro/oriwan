"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/icons";

interface RecoveryTip {
  summary: string;
  muscle_focus: string;
  mission_title: string;
  mission_guide: string;
  stretches: { name: string; duration: string; description: string }[];
  hydration_tip: string;
  encouragement: string;
}

export default function RecoveryPage() {
  const router = useRouter();
  const [tip, setTip] = useState<RecoveryTip | null>(null);
  const [loading, setLoading] = useState(true);
  const [runData, setRunData] = useState<Record<string, number | string | null> | null>(null);

  const formatDistance = (m: number) => (m / 1000).toFixed(2);
  const formatPace = (sec: number, m: number) => {
    const paceMin = sec / 60 / (m / 1000);
    return `${Math.floor(paceMin)}'${String(Math.round((paceMin % 1) * 60)).padStart(2, "0")}"`;
  };

  useEffect(() => {
    const stored = sessionStorage.getItem("oriwan_run_data");
    if (!stored) { router.push("/dashboard"); return; }

    const data = JSON.parse(stored);
    setRunData(data);

    // AI 분석 요청
    fetch("/api/ai/recovery-tip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runData: data }),
    })
      .then((r) => r.json())
      .then((d) => setTip(d.tip))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-oriwan-bg flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 text-oriwan-primary" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
          <p className="text-sm font-bold text-oriwan-text mb-1">AI가 러닝을 분석하고 있어요</p>
          <p className="text-xs text-oriwan-text-muted">맞춤형 리커버리 미션을 준비 중...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-oriwan-bg flex flex-col">
      <header className="px-5 py-4 border-b border-oriwan-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="text-sm text-oriwan-text-muted">← 대시보드</button>
          <h1 className="text-base font-bold gradient-text">리커버리 인증</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4 pb-10">
        {/* 러닝 데이터 요약 */}
        {runData && (
          <div className="card p-5 animate-fade-up">
            <h3 className="text-xs font-bold text-oriwan-text-muted mb-3">오늘의 러닝 데이터</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-black text-oriwan-text">{formatDistance(runData.distance as number)}</p>
                <p className="text-[10px] text-oriwan-text-muted">km</p>
              </div>
              <div>
                <p className="text-lg font-black text-oriwan-text">{formatPace(runData.moving_time as number, runData.distance as number)}</p>
                <p className="text-[10px] text-oriwan-text-muted">페이스</p>
              </div>
              <div>
                <p className="text-lg font-black text-oriwan-text">{Math.floor((runData.moving_time as number) / 60)}</p>
                <p className="text-[10px] text-oriwan-text-muted">분</p>
              </div>
            </div>
            {(runData.average_heartrate || runData.average_cadence) && (
              <div className="grid grid-cols-2 gap-3 text-center mt-3 pt-3 border-t border-oriwan-border/50">
                {runData.average_heartrate && (
                  <div>
                    <p className="text-base font-bold text-oriwan-text">{Math.round(runData.average_heartrate as number)}<span className="text-xs ml-0.5 text-oriwan-text-muted">bpm</span></p>
                    <p className="text-[10px] text-oriwan-text-muted">평균 심박</p>
                  </div>
                )}
                {runData.average_cadence && (
                  <div>
                    <p className="text-base font-bold text-oriwan-text">{Math.round(runData.average_cadence as number)}<span className="text-xs ml-0.5 text-oriwan-text-muted">spm</span></p>
                    <p className="text-[10px] text-oriwan-text-muted">케이던스</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI 분석 + 미션 */}
        {tip && (
          <>
            <div className="card p-5 animate-fade-up" style={{ animationDelay: "0.05s" }}>
              <h3 className="text-sm font-bold mb-2">AI 분석</h3>
              <p className="text-[13px] text-oriwan-text leading-relaxed">{tip.summary}</p>
              <p className="text-xs text-oriwan-text-muted mt-2">
                주요 피로 부위: <span className="font-semibold text-oriwan-primary">{tip.muscle_focus}</span>
              </p>
            </div>

            {/* 추천 스트레칭 */}
            <div className="card p-5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <h3 className="text-sm font-bold mb-3">추천 스트레칭</h3>
              <div className="space-y-2">
                {tip.stretches.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 bg-oriwan-surface-light rounded-xl p-3">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-[11px] font-bold text-oriwan-primary shrink-0">{i+1}</div>
                    <div>
                      <p className="text-[13px] font-semibold">{s.name} <span className="text-[11px] text-oriwan-primary ml-1">{s.duration}</span></p>
                      <p className="text-[11px] text-oriwan-text-muted mt-0.5">{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 수분 + 응원 */}
            <div className="grid grid-cols-1 gap-2 animate-fade-up" style={{ animationDelay: "0.15s" }}>
              <div className="card p-4">
                <p className="text-[11px] text-oriwan-text-muted mb-0.5">💧 수분 보충</p>
                <p className="text-[13px] text-oriwan-text">{tip.hydration_tip}</p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] text-oriwan-text-muted mb-0.5">💪 응원</p>
                <p className="text-[13px] text-oriwan-text">{tip.encouragement}</p>
              </div>
            </div>

            {/* 사진 미션 안내 + 인증 버튼 */}
            <div className="card p-5 border-2 border-oriwan-primary/20 animate-fade-up" style={{ animationDelay: "0.2s" }}>
              <h3 className="text-sm font-bold gradient-text mb-2">{tip.mission_title}</h3>
              <p className="text-[13px] text-oriwan-text leading-relaxed mb-4">{tip.mission_guide}</p>
              <button
                onClick={() => {
                  sessionStorage.setItem("oriwan_mission", JSON.stringify({
                    title: tip.mission_title,
                    guide: tip.mission_guide,
                  }));
                  router.push("/certify");
                }}
                className="btn-primary w-full py-3.5 text-sm"
              >
                📸 미션 사진 인증하기
              </button>
            </div>
          </>
        )}

        {!tip && !loading && (
          <div className="card p-5 text-center">
            <p className="text-sm text-oriwan-text-muted mb-3">AI 분석에 실패했어요</p>
            <button onClick={() => router.push("/certify")} className="btn-primary px-6 py-2.5 text-sm">바로 사진 인증하기</button>
          </div>
        )}
      </main>
    </div>
  );
}
