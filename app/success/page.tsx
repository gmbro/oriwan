"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/icons";

export default function SuccessPage() {
  const router = useRouter();
  const [showStamp, setShowStamp] = useState(false);
  const [runData, setRunData] = useState<Record<string, number> | null>(null);

  const formatDistance = (m: number) => (m / 1000).toFixed(2);
  const formatPace = (sec: number, m: number) => {
    const p = sec / 60 / (m / 1000);
    return `${Math.floor(p)}'${String(Math.round((p % 1) * 60)).padStart(2, "0")}"`;
  };

  useEffect(() => {
    const stored = sessionStorage.getItem("oriwan_run_data");
    if (stored) setRunData(JSON.parse(stored));

    setTimeout(() => setShowStamp(true), 300);

    // 세션 정리
    setTimeout(() => {
      sessionStorage.removeItem("oriwan_run_data");
      sessionStorage.removeItem("oriwan_mission");
    }, 2000);
  }, []);

  return (
    <main className="min-h-screen bg-oriwan-bg flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm w-full">
        {showStamp && (
          <div className="animate-fade-up mb-6">
            <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-oriwan-primary to-oriwan-accent flex items-center justify-center shadow-xl shadow-oriwan-primary/25">
              <IconCheck size={52} className="text-white" />
            </div>
          </div>
        )}

        <h1 className="text-2xl font-black gradient-text animate-fade-up mb-1" style={{ animationDelay: "0.1s" }}>
          오리완 완료!
        </h1>
        <p className="text-oriwan-text-muted text-sm animate-fade-up mb-6" style={{ animationDelay: "0.15s" }}>
          오늘도 멋지게 해냈어요!
        </p>

        {/* 러닝 데이터 요약 */}
        {runData && (
          <div className="card p-5 mb-6 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-black text-oriwan-text">{formatDistance(runData.distance)}</p>
                <p className="text-[10px] text-oriwan-text-muted">km</p>
              </div>
              <div>
                <p className="text-lg font-black text-oriwan-text">{formatPace(runData.moving_time, runData.distance)}</p>
                <p className="text-[10px] text-oriwan-text-muted">페이스</p>
              </div>
              <div>
                <p className="text-lg font-black text-oriwan-text">{Math.floor(runData.moving_time / 60)}</p>
                <p className="text-[10px] text-oriwan-text-muted">분</p>
              </div>
            </div>
            {(runData.average_heartrate || runData.average_cadence) && (
              <div className="flex justify-center gap-6 mt-3 pt-3 border-t border-oriwan-border/50">
                {runData.average_heartrate && <p className="text-xs text-oriwan-text-muted">심박 {Math.round(runData.average_heartrate)}bpm</p>}
                {runData.average_cadence && <p className="text-xs text-oriwan-text-muted">케이던스 {Math.round(runData.average_cadence)}spm</p>}
              </div>
            )}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <IconCheck size={14} className="text-oriwan-success" />
              <span className="text-xs font-bold text-oriwan-success">사진 인증 완료</span>
            </div>
          </div>
        )}

        <button
          onClick={() => { router.push("/dashboard"); router.refresh(); }}
          className="btn-primary w-full py-3.5 text-sm animate-fade-up"
          style={{ animationDelay: "0.25s" }}
        >
          대시보드로 돌아가기
        </button>
      </div>
    </main>
  );
}
