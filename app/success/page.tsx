"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface RecoveryTip {
  summary: string;
  muscle_focus: string;
  stretches: { name: string; duration: string; description: string }[];
  youtube_videos?: { title: string; search_query: string; reason: string }[];
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

        if (!res.ok) throw new Error("AI 응답 오류");

        const data = await res.json();
        setTip(data.tip);

        // Supabase에 오리완 완료 기록 저장
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

          await supabase.from("completions").upsert(
            {
              user_id: user.id,
              completed_date: todayStr,
              distance: runData.distance,
              moving_time: runData.moving_time,
              average_cadence: runData.average_cadence,
              average_heartrate: runData.average_heartrate,
              strava_activity_id: runData.id,
            },
            { onConflict: "user_id,completed_date" }
          );
        }

        setTimeout(() => setShowStamp(true), 500);
      } catch {
        setError("회복 팁을 생성하는 중 문제가 발생했어요.");
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
          <p className="text-oriwan-text-muted text-sm">오늘의 러닝에 딱 맞는 회복 팁을 만들고 있어요!</p>
          <div className="mt-6 w-8 h-8 border-2 border-oriwan-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center card p-8 max-w-md">
          <div className="text-5xl mb-4">😅</div>
          <h2 className="text-xl font-bold mb-2">앗, 문제가 생겼어요</h2>
          <p className="text-oriwan-text-muted text-sm mb-6">{error}</p>
          <Link href="/dashboard" className="btn-primary">대시보드로 돌아가기</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24">
      <header className="sticky top-0 z-50 px-5 py-3.5 bg-oriwan-bg/90 backdrop-blur-md border-b border-oriwan-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-oriwan-text-muted text-sm hover:text-oriwan-text transition-colors">← 대시보드</Link>
          <h1 className="text-lg font-black gradient-text">오리완</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-8 space-y-5">
        {/* 도장 */}
        {showStamp && (
          <div className="text-center animate-fade-up">
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-oriwan-primary to-oriwan-accent shadow-xl shadow-oriwan-primary/20 stamp-complete">
              <span className="text-5xl">🎉</span>
            </div>
            <h2 className="text-2xl font-black mt-5 gradient-text">오리완 완료!</h2>
            <p className="text-oriwan-text-muted mt-1.5 text-sm">오늘도 리커버리를 완료했어요. 대단해요! 🙌</p>
          </div>
        )}

        {tip && (
          <>
            {/* AI 분석 */}
            <div className="card-warm p-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <h3 className="font-bold mb-2 flex items-center gap-2">💬 AI 분석</h3>
              <p className="text-sm leading-relaxed">{tip.summary}</p>
              <p className="text-xs text-oriwan-text-muted mt-3">
                🎯 주요 사용 근육: <strong className="text-oriwan-primary">{tip.muscle_focus}</strong>
              </p>
            </div>

            {/* 스트레칭 */}
            <div className="card p-6 animate-fade-up" style={{ animationDelay: "0.2s" }}>
              <h3 className="font-bold mb-4 flex items-center gap-2">🧘 추천 스트레칭</h3>
              <div className="space-y-3">
                {tip.stretches.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-oriwan-surface-light">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-oriwan-primary/10 to-oriwan-accent/10 flex items-center justify-center text-sm font-bold text-oriwan-primary shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {s.name} <span className="text-xs text-oriwan-accent ml-1">{s.duration}</span>
                      </p>
                      <p className="text-xs text-oriwan-text-muted mt-0.5">{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 유튜브 영상 추천 */}
            {tip.youtube_videos && tip.youtube_videos.length > 0 && (
              <div className="card p-6 animate-fade-up" style={{ animationDelay: "0.3s" }}>
                <h3 className="font-bold mb-4 flex items-center gap-2">🎬 추천 영상</h3>
                <div className="space-y-2.5">
                  {tip.youtube_videos.map((v, i) => (
                    <a
                      key={i}
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(v.search_query)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-oriwan-surface-light hover:bg-oriwan-surface-light/80 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#EF4444">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-oriwan-primary transition-colors">{v.title}</p>
                        <p className="text-xs text-oriwan-text-muted mt-0.5">{v.reason}</p>
                      </div>
                      <span className="text-oriwan-text-muted text-xs shrink-0">→</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 수분 & 격려 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <div className="card p-4">
                <p className="text-sm font-semibold mb-1">💧 수분 보충</p>
                <p className="text-xs text-oriwan-text-muted">{tip.hydration_tip}</p>
              </div>
              <div className="card p-4">
                <p className="text-sm font-semibold mb-1">💪 응원 한마디</p>
                <p className="text-xs text-oriwan-text-muted">{tip.encouragement}</p>
              </div>
            </div>
          </>
        )}

        <div className="text-center animate-fade-up" style={{ animationDelay: "0.4s" }}>
          <Link href="/dashboard" className="btn-primary px-8">대시보드로 돌아가기</Link>
        </div>
      </div>
    </main>
  );
}
