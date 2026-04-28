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

      try { setStravaConnected(document.cookie.includes("oriwan_session")); } catch {}

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
      setLoading(true);
      try {
        const res = await fetch("/api/auth/strava");
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert(data.error || "Strava 연동 준비 중 문제가 생겼어요.");
        }
      } catch (err) {
        console.error("Strava auth error:", err);
        alert("Strava 연동 요청 중 오류가 발생했어요.");
      }
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/strava/activities");
      const data = await res.json();
      if (data.activities?.length > 0) {
        router.push("/success");
      } else {
        alert("오늘 Strava에 기록된 러닝이 없어요!\n달리고 다시 눌러주세요 :)");
      }
    } catch { alert("데이터를 불러오는 중 오류가 발생했어요."); }
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-oriwan-bg flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 px-4 py-3 bg-oriwan-bg/90 backdrop-blur-md border-b border-oriwan-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/oriwan-logo-v2.png" alt="오리완" width={26} height={26} className="object-contain animate-wiggle" />
            <h1 className="text-base font-extrabold gradient-text">오리완</h1>
          </div>
          <div className="flex items-center gap-2">
            {user?.avatar && (
              <Image src={user.avatar} alt="" width={24} height={24} className="rounded-full" />
            )}
            <button onClick={handleLogout} className="text-xs text-oriwan-text-muted hover:text-oriwan-text transition-colors">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full space-y-4">
        {/* 명언 카드 */}
        <div className="card-warm p-4 text-center">
          <p className="text-sm text-oriwan-text leading-relaxed font-medium">
            &ldquo;{quote}&rdquo;
          </p>
        </div>

        {/* 달력 */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-oriwan-text">
              {year}년 {monthNames[month]}
            </h3>
            <span className="text-xs text-oriwan-primary font-bold bg-oriwan-surface-light px-2.5 py-1 rounded-full">
              {completions.length}일 완료
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {["일","월","화","수","목","금","토"].map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-semibold py-0.5 ${i === 0 ? "text-oriwan-danger" : i === 6 ? "text-blue-400" : "text-oriwan-text-muted"}`}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const done = completedDates.has(dateStr);
              const isToday = day === todayDate;
              const isFuture = day > todayDate;

              return (
                <div
                  key={day}
                  className={`aspect-square flex items-center justify-center rounded-xl text-xs font-semibold transition-all ${
                    done
                      ? "stamp-complete shadow-sm"
                      : isToday
                      ? "stamp-today font-bold text-oriwan-primary"
                      : isFuture
                      ? "text-oriwan-text-muted/25"
                      : "text-oriwan-text-muted/50"
                  }`}
                >
                  {done ? <IconCheck size={14} /> : day}
                </div>
              );
            })}
          </div>
        </div>

        {/* 오리완 버튼 */}
        <div className="card p-5 text-center">
          {todayDone ? (
            <div className="space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-oriwan-success/15 flex items-center justify-center animate-float">
                <IconCheck size={28} className="text-oriwan-success" />
              </div>
              <h3 className="font-extrabold text-base gradient-text">오늘의 오리완 완료!</h3>
              <p className="text-xs text-oriwan-text-muted">잘했어요! 내일도 함께 달려요</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-oriwan-text-muted">
                {stravaConnected ? "오늘 달렸다면 인증해보세요!" : "Strava를 연동하면 자동으로 기록돼요"}
              </p>
              <button onClick={handleOriwan} disabled={loading} className="btn-primary w-full py-3.5 text-sm">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <IconSync size={18} className="animate-spin" />
                    준비 중...
                  </span>
                ) : !stravaConnected ? (
                  <span className="flex items-center justify-center gap-2">
                    <IconStrava size={18} />
                    Strava 연동하기
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <IconRun size={18} />
                    오늘의 오리완 시작!
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
