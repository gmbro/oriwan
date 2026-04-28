"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface RunData {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_speed: number;
  max_speed: number;
  average_cadence?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
  start_date_local: string;
  calories?: number;
}

interface UserInfo {
  name: string;
  avatar: string;
}

// ===== 잔디(달력) 컴포넌트 =====
function StreakCalendar({ completedDates }: { completedDates: string[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const todayDate = today.getDate();
  const completedSet = new Set(completedDates);
  const completedCount = completedDates.filter((d) =>
    d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
  ).length;

  const days = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isCompleted = completedSet.has(dateStr);
    const isToday = d === todayDate;

    let cls = "aspect-square flex items-center justify-center text-xs font-medium rounded-lg transition-all ";
    if (isCompleted) cls += "stamp-complete shadow-sm";
    else if (isToday) cls += "stamp-today text-oriwan-primary font-bold";
    else if (d < todayDate) cls += "stamp-empty text-oriwan-text-muted";
    else cls += "stamp-empty text-oriwan-text-muted/40";

    days.push(<div key={d} className={cls}>{d}</div>);
  }

  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

  return (
    <div className="card p-6">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        🌱 {monthNames[month]} 오리완 잔디
      </h3>
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {dayLabels.map((l) => (
          <div key={l} className="aspect-square flex items-center justify-center text-[10px] text-oriwan-text-muted font-medium">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">{days}</div>
      <div className="mt-4 flex items-center justify-between text-xs text-oriwan-text-muted">
        <span>🔥 이번 달 <strong className="text-oriwan-primary">{completedCount}일</strong> 완료</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded stamp-complete inline-block" />
          <span>완료</span>
          <span className="w-3 h-3 rounded stamp-today inline-block" />
          <span>오늘</span>
        </div>
      </div>
    </div>
  );
}

// ===== 러닝 카드 =====
function RunCard({ run }: { run: RunData }) {
  const distanceKm = (run.distance / 1000).toFixed(2);
  const paceMinPerKm = run.moving_time / 60 / (run.distance / 1000);
  const paceMin = Math.floor(paceMinPerKm);
  const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
  const movingMin = Math.floor(run.moving_time / 60);
  const movingSec = run.moving_time % 60;

  return (
    <div className="card-warm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">🏃 오늘의 러닝</h3>
        <span className="text-xs text-oriwan-text-muted bg-white/60 px-2 py-1 rounded-lg">{run.name}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-2xl font-black gradient-text">{distanceKm}</p>
          <p className="text-xs text-oriwan-text-muted mt-1">km</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black">{paceMin}&apos;{String(paceSec).padStart(2, "0")}&quot;</p>
          <p className="text-xs text-oriwan-text-muted mt-1">페이스</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black">{movingMin}:{String(movingSec).padStart(2, "0")}</p>
          <p className="text-xs text-oriwan-text-muted mt-1">시간</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black">{run.average_cadence ? Math.round(run.average_cadence * 2) : "—"}</p>
          <p className="text-xs text-oriwan-text-muted mt-1">케이던스</p>
        </div>
      </div>
      {(run.average_heartrate || run.total_elevation_gain) && (
        <div className="mt-4 pt-4 border-t border-orange-200/50 flex items-center gap-5 text-sm text-oriwan-text-muted">
          {run.average_heartrate && <span>❤️ {Math.round(run.average_heartrate)} bpm</span>}
          {run.total_elevation_gain && <span>⛰️ {Math.round(run.total_elevation_gain)}m</span>}
          {run.calories && <span>🔥 {run.calories} kcal</span>}
        </div>
      )}
    </div>
  );
}

// ===== 메인 대시보드 =====
export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [runData, setRunData] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  const [hasStrava, setHasStrava] = useState(false);

  // 유저 정보 + 완료 기록 로드
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({
          name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "러너",
          avatar: authUser.user_metadata?.avatar_url || "",
        });

        // 완료 기록 로드
        const { data: records } = await supabase
          .from("completions")
          .select("completed_date")
          .eq("user_id", authUser.id);
        if (records) {
          setCompletedDates(records.map((r: { completed_date: string }) => r.completed_date));
        }
      }

      // Strava 연동 여부
      const sessionCookie = document.cookie.split("; ").find((r) => r.startsWith("oriwan_session="));
      setHasStrava(!!sessionCookie);
      setLoading(false);
    };
    loadData();
  }, []);

  // Strava 동기화
  const syncActivities = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/strava/activities");
      if (res.status === 401) { setHasStrava(false); return; }
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      if (data.hasRun && data.activities.length > 0) {
        setRunData(data.activities[0]);
      } else {
        setError("오늘 Strava에 기록된 러닝이 없어요. 먼저 달려보세요! 🏃‍♂️");
      }
    } catch {
      setError("데이터를 가져오는 중 문제가 발생했어요.");
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-float">🏃</div>
          <p className="text-sm text-oriwan-text-muted">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 px-5 py-3.5 bg-oriwan-bg/90 backdrop-blur-md border-b border-oriwan-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-lg font-black gradient-text">오리완</h1>
          <div className="flex items-center gap-2">
            {user?.avatar && (
              <img src={user.avatar} alt="" className="w-7 h-7 rounded-full border border-oriwan-border" />
            )}
            <button onClick={handleLogout} className="text-xs text-oriwan-text-muted hover:text-oriwan-danger transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-5">
        {/* 인사말 */}
        <div className="animate-fade-up">
          <h2 className="text-xl font-bold">{user ? `${user.name}님, 안녕하세요! 👋` : "안녕하세요! 👋"}</h2>
          <p className="text-oriwan-text-muted text-sm mt-1">오늘도 오리완을 완성해볼까요?</p>
        </div>

        {error && (
          <div className="card-warm p-4 text-sm text-orange-700 animate-fade-up">{error}</div>
        )}

        {/* ===== Strava 미연동 시: 필수 연동 안내 (1순위) ===== */}
        {!hasStrava ? (
          <div className="card p-8 text-center animate-fade-up border-2 border-dashed border-oriwan-primary/30">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FC4C02]/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#FC4C02">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">Strava를 연동해주세요! 🔗</h3>
            <p className="text-sm text-oriwan-text-muted mb-2 leading-relaxed">
              오리완은 Strava 러닝 데이터를 분석해서
              <br />맞춤형 회복 팁을 제공해요.
            </p>
            <p className="text-xs text-oriwan-text-muted mb-5">
              거리, 케이던스, 페이스, 심박수 등이 자동으로 연동됩니다.
            </p>
            <a href="/api/auth/strava" className="btn-primary text-base px-8 py-3.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              Strava 연동하기
            </a>
          </div>
        ) : !runData ? (
          /* ===== Strava 연동 완료 → 오늘의 기록 동기화 ===== */
          <div className="card p-8 text-center animate-fade-up">
            <div className="text-5xl mb-4 animate-float">🏃</div>
            <h3 className="font-bold mb-2">오늘의 러닝 기록을 가져올까요?</h3>
            <p className="text-oriwan-text-muted text-sm mb-5">Strava에서 오늘 뛴 기록을 자동으로 불러와요!</p>
            <button onClick={syncActivities} disabled={syncing} className="btn-primary">
              {syncing ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 동기화 중...</>
              ) : "📡 Strava 동기화"}
            </button>
          </div>
        ) : (
          /* ===== 러닝 데이터 표시 + AI 회복 팁 버튼 ===== */
          <>
            <div className="animate-fade-up"><RunCard run={runData} /></div>
            <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <Link
                href={`/success?runId=${runData.id}`}
                className="btn-primary w-full text-center text-lg py-4 block"
                onClick={() => sessionStorage.setItem("oriwan_run_data", JSON.stringify(runData))}
              >
                🧬 AI 회복 팁 받고 오리완 완료! 🎉
              </Link>
            </div>
          </>
        )}

        {/* 잔디 */}
        <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <StreakCalendar completedDates={completedDates} />
        </div>
      </div>
    </main>
  );
}
