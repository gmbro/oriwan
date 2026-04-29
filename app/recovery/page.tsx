"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/icons";

export default function RecoveryPage() {
  const router = useRouter();
  const [tip, setTip] = useState("");
  const [tipLoading, setTipLoading] = useState(true);
  const [duration, setDuration] = useState(0);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}분 ${sec}초`;
  };

  useEffect(() => {
    // 운동 데이터 가져오기
    const data = sessionStorage.getItem("oriwan_workout");
    if (!data) {
      router.push("/dashboard");
      return;
    }
    const workout = JSON.parse(data);
    setDuration(workout.duration);

    // AI 리커버리 팁
    fetch("/api/ai/recovery", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setTip(d.tip || "가벼운 스트레칭으로 근육의 긴장을 풀어주세요."))
      .catch(() => setTip("가벼운 스트레칭으로 근육의 긴장을 풀어주세요."))
      .finally(() => setTipLoading(false));
  }, [router]);

  const stretches = [
    { name: "허벅지 앞쪽", how: "한 발로 서서 뒤쪽 발을 잡고 30초 유지" },
    { name: "종아리", how: "벽에 손을 짚고 한쪽 다리를 뒤로 뻗어 30초" },
    { name: "고관절", how: "런지 자세에서 골반을 앞으로 밀며 30초" },
    { name: "햄스트링", how: "다리를 펴고 앉아 발끝을 잡으며 30초" },
  ];

  return (
    <div className="min-h-screen bg-oriwan-bg flex flex-col">
      <header className="px-5 py-4 border-b border-oriwan-border/50">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold gradient-text text-center">리커버리 인증</h1>
        </div>
      </header>

      <main className="flex-1 px-5 py-6 max-w-lg mx-auto w-full space-y-5 pb-10">
        {/* 운동 결과 */}
        <div className="card p-5 text-center animate-fade-up">
          <p className="text-sm text-oriwan-text-muted mb-1">오늘의 러닝</p>
          <p className="text-3xl font-black text-oriwan-text">{formatTime(duration)}</p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <IconCheck size={14} className="text-oriwan-success" />
            <span className="text-xs font-bold text-oriwan-success">러닝 완료!</span>
          </div>
        </div>

        {/* AI 회복 팁 */}
        <div className="card p-5 animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <h3 className="text-sm font-bold mb-3">AI 회복 팁</h3>
          {tipLoading ? (
            <p className="text-sm text-oriwan-text-muted animate-pulse">분석 중...</p>
          ) : (
            <p className="text-[14px] text-oriwan-text leading-[1.7] whitespace-pre-line">{tip}</p>
          )}
        </div>

        {/* 스트레칭 가이드 */}
        <div className="card p-5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <h3 className="text-sm font-bold mb-3">추천 스트레칭</h3>
          <div className="space-y-2.5">
            {stretches.map((s, i) => (
              <div key={i} className="flex items-start gap-3 bg-oriwan-surface-light rounded-xl p-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-bold text-oriwan-primary shrink-0">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-oriwan-text-muted mt-0.5">{s.how}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 사진 인증 버튼 */}
        <button
          onClick={() => router.push("/certify")}
          className="btn-primary w-full py-4 text-[15px] animate-fade-up"
          style={{ animationDelay: "0.15s" }}
        >
          📸 사진 인증하기
        </button>
      </main>
    </div>
  );
}
