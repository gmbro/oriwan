"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
    <div className="card p-5">
      <h3 className="text-base font-bold mb-3 flex items-center gap-2">
        🌱 {monthNames[month]} 오리완 잔디
      </h3>
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {dayLabels.map((l) => (
          <div key={l} className="aspect-square flex items-center justify-center text-[10px] text-oriwan-text-muted font-medium">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">{days}</div>
      <div className="mt-3 flex items-center justify-between text-xs text-oriwan-text-muted">
        <span>🔥 <strong className="text-oriwan-primary">{completedCount}일</strong> 완료</span>
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

// ===== 메인 대시보드 =====
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  const [hasStrava, setHasStrava] = useState(false);
  const [todayDone, setTodayDone] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({
          name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "러너",
          avatar: authUser.user_metadata?.avatar_url || "",
        });

        const { data: records } = await supabase
          .from("completions")
          .select("completed_date")
          .eq("user_id", authUser.id);
        if (records) {
          const dates = records.map((r: { completed_date: string }) => r.completed_date);
          setCompletedDates(dates);

          // 오늘 이미 완료했는지 확인
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          setTodayDone(dates.includes(todayStr));
        }
      }

      const sessionCookie = document.cookie.split("; ").find((r) => r.startsWith("oriwan_session="));
      setHasStrava(!!sessionCookie);
      setLoading(false);
    };
    loadData();
  }, []);

  // ===== 원클릭 오리완: Strava 동기화 → AI 팁 → 완료 (한 번에!) =====
  const handleOneClickOriwan = async () => {
    setProcessing(true);
    setError(null);
    try {
      // 1. Strava에서 오늘 러닝 가져오기
      const res = await fetch("/api/strava/activities");
      if (res.status === 401) { setHasStrava(false); setProcessing(false); return; }
      const data = await res.json();

      if (!data.hasRun || data.activities.length === 0) {
        setError("오늘 Strava에 기록된 러닝이 없어요. 먼저 달려보세요! 🏃‍♂️");
        setProcessing(false);
        return;
      }

      // 2. 러닝 데이터를 sessionStorage에 저장하고 성공 페이지로 이동
      const runData: RunData = data.activities[0];
      sessionStorage.setItem("oriwan_run_data", JSON.stringify(runData));

      // 3. 성공 페이지에서 AI 팁 생성 + DB 저장이 자동으로 진행됨
      router.push(`/success?runId=${runData.id}`);
    } catch {
      setError("문제가 발생했어요. 다시 시도해주세요.");
      setProcessing(false);
    }
  };

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
      <header className="sticky top-0 z-50 px-5 py-3 bg-oriwan-bg/90 backdrop-blur-md border-b border-oriwan-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/oriwan-logo.png" alt="오리완" width={28} height={28} className="object-contain" />
            <h1 className="text-lg font-black gradient-text">오리완</h1>
          </div>
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
        <div className="animate-fade-up text-center">
          <h2 className="text-lg font-bold">{user ? `${user.name}님, 안녕하세요! 👋` : "안녕하세요! 👋"}</h2>
        </div>

        {error && (
          <div className="card-warm p-4 text-sm text-orange-700 animate-fade-up text-center">{error}</div>
        )}

        {/* ===== 잔디 달력 (메인) ===== */}
        <div className="animate-fade-up">
          <StreakCalendar completedDates={completedDates} />
        </div>

        {/* ===== 원클릭 액션 버튼 ===== */}
        {!hasStrava ? (
          /* Strava 미연동 */
          <div className="card p-6 text-center animate-fade-up border-2 border-dashed border-oriwan-primary/30">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#FC4C02]/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FC4C02">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
            </div>
            <h3 className="font-bold mb-1">Strava를 연동해주세요!</h3>
            <p className="text-xs text-oriwan-text-muted mb-4">
              러닝 데이터를 자동으로 가져와요
            </p>
            <a href="/api/auth/strava" className="btn-primary text-sm px-6 py-3">
              Strava 연동하기
            </a>
          </div>
        ) : todayDone ? (
          /* 오늘 이미 완료 */
          <div className="card-warm p-6 text-center animate-fade-up">
            <div className="text-4xl mb-2">🎉</div>
            <h3 className="font-bold text-lg gradient-text">오늘의 오리완 완료!</h3>
            <p className="text-sm text-oriwan-text-muted mt-1">내일도 화이팅! 💪</p>
          </div>
        ) : (
          /* 원클릭 오리완 버튼 */
          <div className="animate-fade-up">
            <button
              onClick={handleOneClickOriwan}
              disabled={processing}
              className="btn-primary w-full text-center text-lg py-5 block rounded-2xl"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  동기화 & 분석 중...
                </span>
              ) : (
                "🏃 오늘의 오리완 시작!"
              )}
            </button>
            <p className="text-center text-[11px] text-oriwan-text-muted mt-2">
              Strava 동기화 → AI 회복 팁 → 도장까지 한 번에!
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
