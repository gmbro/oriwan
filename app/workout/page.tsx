"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function WorkoutPage() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 타이머
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleStop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);

    // 운동 데이터를 sessionStorage에 저장
    sessionStorage.setItem("oriwan_workout", JSON.stringify({
      duration: seconds,
      startedAt: new Date(Date.now() - seconds * 1000).toISOString(),
      endedAt: new Date().toISOString(),
    }));

    router.push("/recovery");
  }, [seconds, router]);

  return (
    <div className="min-h-screen bg-oriwan-bg flex flex-col">
      {/* 헤더 */}
      <header className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden">
            <Image src="/oriwan-logo-v2.png" alt="오리완" width={28} height={28} className="object-cover" />
          </div>
          <span className="text-sm font-bold gradient-text">러닝 중</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-oriwan-success animate-pulse" />
          <span className="text-xs font-bold text-oriwan-success">ACTIVE</span>
        </div>
      </header>

      {/* 타이머 */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-oriwan-text-muted mb-4">경과 시간</p>
          <div className="text-7xl font-black text-oriwan-text tracking-tight tabular-nums">
            {formatTime(seconds)}
          </div>
          <p className="text-sm text-oriwan-text-muted mt-4">
            화면을 끄고 러닝하세요. 돌아오면 여기서 계속됩니다.
          </p>
        </div>

        {/* 종료 버튼 */}
        <button
          onClick={handleStop}
          className="w-28 h-28 rounded-full bg-oriwan-danger text-white font-bold text-lg shadow-lg shadow-oriwan-danger/30 hover:shadow-xl hover:shadow-oriwan-danger/40 active:scale-95 transition-all flex items-center justify-center"
        >
          종료
        </button>
        <p className="text-xs text-oriwan-text-muted mt-4">러닝이 끝나면 눌러주세요</p>
      </main>
    </div>
  );
}
