"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { IconCheck, IconStrava, IconSync, IconRun } from "@/components/icons";
import { getDailyQuote } from "@/lib/quotes";

interface RunData {
  id: number;
  completed_date: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; avatar: string } | null>(null);
  const [completions, setCompletions] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [todayDone, setTodayDone] = useState(false);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();
  const todayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(todayDate).padStart(2, "0")}`;
  const quote = getDailyQuote();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push("/"); return; }

      setUser({
        name: u.user_metadata?.full_name || u.email?.split("@")[0] || "러너",
        avatar: u.user_metadata?.avatar_url || "",
      });

      // Strava 연동 확인
      try { const c = document.cookie; setStravaConnected(c.includes("oriwan_session")); } catch {}

      // 이번 달 완료 기록
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;
      const { data } = await supabase
        .from("completions")
        .select("id, completed_date")
        .gte("completed_date", startDate)
        .lte("completed_date", endDate);

      if (data) {
        setCompletions(data);
        setTodayDone(data.some((d) => d.completed_date === todayStr));
      }
    };
    init();
  }, [router, year, month, daysInMonth, todayStr]);

  const completedDates = new Set(completions.map((c) => c.completed_date));

  const handleOriwan = async () => {
    if (todayDone || loading) return;
    if (!stravaConnected) {
      const res = await fetch("/api/auth/strava");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/strava/activities");
      const data = await res.json();
      if (data.activities?.length > 0) {
        router.push("/success");
      } else {
        alert("오늘 Strava에 기록된 러닝이 없어요. 달리고 다시 시도해주세요!");
      }
    } catch { alert("데이터를 불러오는 중 오류가 발생했어요."); }
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const completedCount = completions.length;

  return (
    <div className="min-h-screen bg-oriwan-bg flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 px-4 py-2.5 bg-oriwan-bg/90 backdrop-blur-md border-b border-oriwan-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/oriwan-logo-v2.png" alt="오리완" width={24} height={24} className="object-contain" />
            <h1 className="text-base font-extrabold gradient-text">오리완</h1>
          </div>
          <button onClick={handleLogout} className="text-xs text-oriwan-text-muted hover:text-oriwan-text">
            로그아웃
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full space-y-3">
        {/* 오늘의 명언 */}
        <div className="text-center py-3">
          <p className="text-sm text-oriwan-text-muted italic leading-relaxed">&ldquo;{quote}&rdquo;</p>
        </div>

        {/* 달력 */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">{year}년 {monthNames[month]}</h3>
            <span className="text-xs text-oriwan-primary font-semibold">{completedCount}일 완료</span>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["일","월","화","수","목","금","토"].map((d) => (
              <div key={d} className="text-center text-[10px] text-oriwan-text-muted font-medium py-0.5">{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const done = completedDates.has(dateStr);
              const isToday = day === todayDate;
              const isFuture = day > todayDate;

              return (
                <div
                  key={day}
                  className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                    done
                      ? "bg-gradient-to-br from-oriwan-primary to-oriwan-accent text-white font-bold shadow-sm"
                      : isToday
                      ? "border-2 border-oriwan-primary text-oriwan-primary font-bold"
                      : isFuture
                      ? "text-oriwan-text-muted/30"
                      : "text-oriwan-text-muted/60"
                  }`}
                >
                  {done ? <IconCheck size={14} /> : day}
                </div>
              );
            })}
          </div>
        </div>

        {/* 오리완 버튼 */}
        <div className="card p-4 text-center">
          {todayDone ? (
            <div>
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-oriwan-success/10 flex items-center justify-center">
                <IconCheck size={20} className="text-oriwan-success" />
              </div>
              <h3 className="font-bold text-sm gradient-text">오늘의 오리완 완료!</h3>
              <p className="text-xs text-oriwan-text-muted mt-0.5">내일도 함께 달려요</p>
            </div>
          ) : (
            <button onClick={handleOriwan} disabled={loading} className="btn-primary w-full text-sm py-3">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <IconSync size={18} className="animate-spin" />
                  동기화 중...
                </span>
              ) : !stravaConnected ? (
                <span className="flex items-center justify-center gap-2">
                  <IconStrava size={18} />
                  Strava 연동하고 시작하기
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <IconRun size={18} />
                  오늘의 오리완 시작!
                </span>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
