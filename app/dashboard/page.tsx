"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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
  id: number;
  name: string;
  profile: string;
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

  const days = [];
  // 빈 칸 (해당 달 1일 이전)
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isCompleted = completedSet.has(dateStr);
    const isToday = d === todayDate;

    let className = "aspect-square flex items-center justify-center text-xs font-medium rounded-lg transition-all ";

    if (isCompleted) {
      className += "stamp-complete text-white shadow-lg";
    } else if (isToday) {
      className += "stamp-today text-oriwan-primary font-bold";
    } else if (d < todayDate) {
      className += "stamp-empty text-oriwan-text-muted";
    } else {
      className += "stamp-empty text-oriwan-text-muted/40";
    }

    days.push(
      <div key={d} className={className}>
        {d}
      </div>
    );
  }

  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        🌱 {monthNames[month]} 오리완 잔디
      </h3>
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {dayLabels.map((label) => (
          <div
            key={label}
            className="aspect-square flex items-center justify-center text-[10px] text-oriwan-text-muted font-medium"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">{days}</div>
      <div className="mt-4 flex items-center justify-between text-xs text-oriwan-text-muted">
        <span>🔥 이번 달 {completedDates.filter((d) => d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length}일 완료</span>
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

// ===== 러닝 카드 컴포넌트 =====
function RunCard({ run }: { run: RunData }) {
  const distanceKm = (run.distance / 1000).toFixed(2);
  const paceMinPerKm = run.moving_time / 60 / (run.distance / 1000);
  const paceMin = Math.floor(paceMinPerKm);
  const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
  const movingMin = Math.floor(run.moving_time / 60);
  const movingSec = run.moving_time % 60;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          🏃 오늘의 러닝
        </h3>
        <span className="text-xs text-oriwan-text-muted">{run.name}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-2xl font-black gradient-text">{distanceKm}</p>
          <p className="text-xs text-oriwan-text-muted mt-1">km</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-oriwan-text">
            {paceMin}&apos;{String(paceSec).padStart(2, "0")}&quot;
          </p>
          <p className="text-xs text-oriwan-text-muted mt-1">페이스</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-oriwan-text">
            {movingMin}:{String(movingSec).padStart(2, "0")}
          </p>
          <p className="text-xs text-oriwan-text-muted mt-1">시간</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-oriwan-text">
            {run.average_cadence ? Math.round(run.average_cadence * 2) : "—"}
          </p>
          <p className="text-xs text-oriwan-text-muted mt-1">케이던스</p>
        </div>
      </div>

      {(run.average_heartrate || run.total_elevation_gain) && (
        <div className="mt-4 pt-4 border-t border-oriwan-border flex items-center gap-6 text-sm text-oriwan-text-muted">
          {run.average_heartrate && (
            <span>❤️ 평균 {Math.round(run.average_heartrate)} bpm</span>
          )}
          {run.total_elevation_gain && (
            <span>⛰️ 고도 {Math.round(run.total_elevation_gain)}m</span>
          )}
          {run.calories && <span>🔥 {run.calories} kcal</span>}
        </div>
      )}
    </div>
  );
}

// ===== 대시보드 메인 =====
export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [runData, setRunData] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 완료된 날짜 (localStorage에서 로드, 추후 DB 연동 시 교체)
  const [completedDates, setCompletedDates] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("oriwan_completed_dates");
      if (saved) {
        setCompletedDates(JSON.parse(saved));
      }
    } catch {
      // localStorage 접근 불가 시 무시
    }
  }, []);

  // 유저 정보 로드 (공개 쿠키에서)
  useEffect(() => {
    try {
      const userCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("oriwan_user="));
      if (userCookie) {
        const userData = JSON.parse(decodeURIComponent(userCookie.split("=")[1]));
        setUser(userData);
      }
    } catch {
      console.error("Failed to parse user cookie");
    }
    setLoading(false);
  }, []);

  // Strava 데이터 동기화
  const syncActivities = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/strava/activities");
      if (res.status === 401) {
        window.location.href = "/";
        return;
      }
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.hasRun && data.activities.length > 0) {
        setRunData(data.activities[0]);
      }
    } catch {
      setError("데이터를 가져오는 중 오류가 발생했습니다.");
    } finally {
      setSyncing(false);
    }
  }, []);

  // 로그아웃
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-oriwan-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-24">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 px-6 py-4 bg-oriwan-bg/80 backdrop-blur-lg border-b border-oriwan-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-black gradient-text">오리완</h1>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-oriwan-text-muted hidden sm:block">
                {user.name}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-xs text-oriwan-text-muted hover:text-oriwan-danger transition-colors px-3 py-1.5 rounded-lg hover:bg-oriwan-danger/10"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* 인사말 */}
        <div className="animate-fade-up">
          <h2 className="text-2xl font-bold">
            {user ? `${user.name}님,` : "안녕하세요,"}
          </h2>
          <p className="text-oriwan-text-muted mt-1">오늘도 오리완을 완성해볼까요?</p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="glass-card p-4 border-oriwan-danger/30 text-oriwan-danger text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* 러닝 데이터 동기화 */}
        {!runData ? (
          <div className="glass-card p-8 text-center animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <div className="text-5xl mb-4 animate-float">🏃</div>
            <h3 className="text-lg font-bold mb-2">오늘의 러닝 기록을 가져올까요?</h3>
            <p className="text-oriwan-text-muted text-sm mb-6">
              Strava에서 오늘 뛴 기록을 자동으로 불러옵니다.
            </p>
            <button
              onClick={syncActivities}
              disabled={syncing}
              className="btn-primary"
            >
              {syncing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  동기화 중...
                </>
              ) : (
                "📡 Strava 데이터 동기화"
              )}
            </button>
          </div>
        ) : (
          <>
            {/* 러닝 데이터 카드 */}
            <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <RunCard run={runData} />
            </div>

            {/* AI 회복 팁 받기 버튼 */}
            <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
              <Link
                href={`/success?runId=${runData.id}`}
                className="btn-primary w-full text-center text-lg py-4 block"
                onClick={() => {
                  // 러닝 데이터를 sessionStorage에 임시 저장 (이동 간 전달용)
                  sessionStorage.setItem("oriwan_run_data", JSON.stringify(runData));
                }}
              >
                🧬 AI 회복 팁 받고 오리완 완료하기
              </Link>
            </div>
          </>
        )}

        {/* 잔디 (달력) */}
        <div className="animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <StreakCalendar completedDates={completedDates} />
        </div>
      </div>
    </main>
  );
}
