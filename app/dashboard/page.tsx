"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { IconSprout, IconFlame, IconCheck, IconStrava, IconSync, IconParty, IconRun } from "@/components/icons";

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
        <IconSprout size={18} className="text-oriwan-success" />
        {monthNames[month]} ORIWAN 잔디
      </h3>
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {dayLabels.map((l) => (
          <div key={l} className="aspect-square flex items-center justify-center text-[10px] text-oriwan-text-muted font-medium">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">{days}</div>
      <div className="mt-3 flex items-center justify-between text-xs text-oriwan-text-muted">
        <span className="flex items-center gap-1">
          <IconFlame size={14} className="text-oriwan-primary" />
          <strong className="text-oriwan-primary">{completedCount}일</strong> 완료
        </span>
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

  const handleOneClickOriwan = async () => {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/strava/activities");
      if (res.status === 401) { setHasStrava(false); setProcessing(false); return; }
      const data = await res.json();
      if (!data.hasRun || data.activities.length === 0) {
        setError("아직 오늘의 러닝이 없어요. 먼저 한 바퀴 뛰어볼까요?");
        setProcessing(false);
        return;
      }
      const runData: RunData = data.activities[0];
      sessionStorage.setItem("oriwan_run_data", JSON.stringify(runData));
      router.push(`/success?runId=${runData.id}`);
    } catch {
      setError("문제가 발생했어요. 다시 시도해주세요!");
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
          <IconSync size={28} className="text-oriwan-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-oriwan-text-muted">잠시만요...</p>
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
            <Image src="/oriwan-logo.png" alt="ORIWAN" width={28} height={28} className="object-contain" />
            <h1 className="text-lg font-black gradient-text">ORIWAN</h1>
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
          <h2 className="text-lg font-bold">{user ? `${user.name}님, 반가워요!` : "반가워요!"}</h2>
          <p className="text-sm text-oriwan-text-muted mt-0.5">오늘도 함께 달려볼까요?</p>
        </div>

        {error && (
          <div className="card-warm p-4 text-sm text-orange-700 animate-fade-up text-center">{error}</div>
        )}

        {/* 잔디 달력 */}
        <div className="animate-fade-up">
          <StreakCalendar completedDates={completedDates} />
        </div>

        {/* 액션 버튼 */}
        {!hasStrava ? (
          <div className="card p-6 text-center animate-fade-up border-2 border-dashed border-oriwan-primary/30">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#FC4C02]/10 flex items-center justify-center">
              <IconStrava size={24} className="text-[#FC4C02]" />
            </div>
            <h3 className="font-bold mb-1">Strava 연동이 필요해요</h3>
            <p className="text-xs text-oriwan-text-muted mb-4">
              러닝 데이터를 자동으로 연동해드릴게요
            </p>
            <a href="/api/auth/strava" className="btn-primary text-sm px-6 py-3 inline-flex items-center gap-2">
              <IconStrava size={16} />
              Strava 연동하기
            </a>
          </div>
        ) : todayDone ? (
          <div className="card-warm p-6 text-center animate-fade-up">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-oriwan-success/10 flex items-center justify-center">
              <IconCheck size={24} className="text-oriwan-success" />
            </div>
            <h3 className="font-bold text-lg gradient-text">오늘의 ORIWAN 완료!</h3>
            <p className="text-sm text-oriwan-text-muted mt-1">멋져요, 내일도 함께 달려요!</p>
          </div>
        ) : (
          <div className="animate-fade-up">
            <button
              onClick={handleOneClickOriwan}
              disabled={processing}
              className="btn-primary w-full text-center text-lg py-5 block rounded-2xl"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <IconSync size={20} className="animate-spin" />
                  동기화 & 분석 중...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <IconRun size={22} />
                  오늘의 ORIWAN 시작!
                </span>
              )}
            </button>
            <p className="text-center text-[11px] text-oriwan-text-muted mt-2">
              Strava 동기화부터 AI 회복 팁까지, 원클릭으로 끝!
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
