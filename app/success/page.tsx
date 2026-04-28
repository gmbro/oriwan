"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface RecoveryTip {
  summary: string;
  muscle_focus: string;
  stretches: {
    name: string;
    duration: string;
    description: string;
  }[];
  hydration_tip: string;
  encouragement: string;
}

export default function SuccessPage() {
  const [tip, setTip] = useState<RecoveryTip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStamp, setShowStamp] = useState(false);

  useEffect(() => {
    const fetchTip = async () => {
      try {
        const stored = sessionStorage.getItem("oriwan_run_data");
        if (!stored) {
          setError("러닝 데이터가 없습니다. 대시보드에서 다시 시도해주세요.");
          setLoading(false);
          return;
        }

        const runData = JSON.parse(stored);
        const res = await fetch("/api/ai/recovery-tip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runData }),
        });

        if (!res.ok) {
          throw new Error("AI 응답 오류");
        }

        const data = await res.json();
        setTip(data.tip);

        // 오늘 날짜를 완료 목록에 저장 (잔디 달력에 반영)
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        try {
          const saved = localStorage.getItem("oriwan_completed_dates");
          const dates: string[] = saved ? JSON.parse(saved) : [];
          if (!dates.includes(todayStr)) {
            dates.push(todayStr);
            localStorage.setItem("oriwan_completed_dates", JSON.stringify(dates));
          }
        } catch {
          // localStorage 접근 불가 시 무시
        }

        // 도장 애니메이션 지연
        setTimeout(() => setShowStamp(true), 500);
      } catch {
        setError("회복 팁을 생성하는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchTip();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-float">🧬</div>
          <h2 className="text-xl font-bold mb-2">AI가 분석 중이에요...</h2>
          <p className="text-oriwan-text-muted text-sm">
            오늘의 러닝 데이터를 기반으로 맞춤형 회복 팁을 생성하고 있습니다.
          </p>
          <div className="mt-6 w-8 h-8 border-2 border-oriwan-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center glass-card p-8 max-w-md">
          <div className="text-5xl mb-4">😢</div>
          <h2 className="text-xl font-bold mb-2">오류가 발생했습니다</h2>
          <p className="text-oriwan-text-muted text-sm mb-6">{error}</p>
          <Link href="/dashboard" className="btn-primary">
            대시보드로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24">
      {/* 상단 */}
      <header className="sticky top-0 z-50 px-6 py-4 bg-oriwan-bg/80 backdrop-blur-lg border-b border-oriwan-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-oriwan-text-muted text-sm hover:text-oriwan-text transition-colors">
            ← 대시보드
          </Link>
          <h1 className="text-xl font-black gradient-text">오리완</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* 도장 */}
        {showStamp && (
          <div className="text-center animate-fade-up">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-oriwan-primary to-oriwan-accent shadow-2xl stamp-complete">
              <span className="text-5xl">✅</span>
            </div>
            <h2 className="text-2xl font-black mt-6 gradient-text">
              오리완 완료!
            </h2>
            <p className="text-oriwan-text-muted mt-2">오늘의 리커버리를 완료했어요 🎉</p>
          </div>
        )}

        {/* AI 분석 요약 */}
        {tip && (
          <>
            <div className="glass-card p-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                💬 AI 분석
              </h3>
              <p className="text-oriwan-text leading-relaxed">{tip.summary}</p>
              <p className="text-sm text-oriwan-text-muted mt-3">
                🎯 주요 사용 근육: <strong className="text-oriwan-primary">{tip.muscle_focus}</strong>
              </p>
            </div>

            {/* 스트레칭 추천 */}
            <div className="glass-card p-6 animate-fade-up" style={{ animationDelay: "0.2s" }}>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                🧘 추천 스트레칭
              </h3>
              <div className="space-y-4">
                {tip.stretches.map((stretch, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-xl bg-oriwan-surface-light/50"
                  >
                    <div className="w-10 h-10 rounded-xl bg-oriwan-primary/10 flex items-center justify-center text-lg shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {stretch.name}{" "}
                        <span className="text-xs text-oriwan-accent ml-1">{stretch.duration}</span>
                      </p>
                      <p className="text-sm text-oriwan-text-muted mt-1">
                        {stretch.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 수분 보충 & 격려 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <div className="glass-card p-5">
                <p className="text-sm font-semibold mb-2">💧 수분 보충</p>
                <p className="text-sm text-oriwan-text-muted">{tip.hydration_tip}</p>
              </div>
              <div className="glass-card p-5">
                <p className="text-sm font-semibold mb-2">🔥 응원 한마디</p>
                <p className="text-sm text-oriwan-text-muted">{tip.encouragement}</p>
              </div>
            </div>
          </>
        )}

        {/* 돌아가기 */}
        <div className="text-center animate-fade-up" style={{ animationDelay: "0.4s" }}>
          <Link href="/dashboard" className="btn-primary px-8">
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
