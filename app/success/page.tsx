"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/icons";

export default function SuccessPage() {
  const router = useRouter();
  const [duration, setDuration] = useState(0);
  const [showStamp, setShowStamp] = useState(false);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}분 ${sec}초`;
  };

  useEffect(() => {
    const workoutStr = sessionStorage.getItem("oriwan_workout");
    if (workoutStr) {
      const w = JSON.parse(workoutStr);
      setDuration(w.duration || 0);
    }

    // 사용한 세션 데이터 정리
    setTimeout(() => {
      sessionStorage.removeItem("oriwan_workout");
      sessionStorage.removeItem("oriwan_certified");
    }, 1000);

    // 축하 애니메이션
    setTimeout(() => setShowStamp(true), 300);
  }, []);

  return (
    <main className="min-h-screen bg-oriwan-bg flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm w-full">
        {/* 축하 도장 */}
        {showStamp && (
          <div className="animate-fade-up mb-8">
            <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-oriwan-primary to-oriwan-accent flex items-center justify-center shadow-xl shadow-oriwan-primary/25">
              <IconCheck size={52} className="text-white" />
            </div>
          </div>
        )}

        <h1 className="text-2xl font-black gradient-text animate-fade-up mb-2" style={{ animationDelay: "0.1s" }}>
          오리완 완료!
        </h1>
        <p className="text-oriwan-text-muted text-sm animate-fade-up mb-8" style={{ animationDelay: "0.15s" }}>
          오늘도 멋지게 해냈어요. 정말 대단해요!
        </p>

        {/* 운동 요약 */}
        <div className="card p-5 mb-6 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-xs text-oriwan-text-muted">러닝 시간</p>
              <p className="text-xl font-bold text-oriwan-text">{formatTime(duration)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-oriwan-text-muted">인증</p>
              <p className="text-sm font-bold text-oriwan-success flex items-center gap-1">
                <IconCheck size={14} /> 완료
              </p>
            </div>
          </div>
        </div>

        {/* 대시보드 돌아가기 */}
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
