"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { IconCheck, IconRun, IconDna, IconSprout } from "@/components/icons";
import { getDailyQuote } from "@/lib/quotes";

interface CompletionData {
  id: string;
  completed_date: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; avatar: string } | null>(null);
  const [completions, setCompletions] = useState<CompletionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [todayDone, setTodayDone] = useState(false);
  const [recoveryTip, setRecoveryTip] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();
  const todayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(todayDate).padStart(2, "0")}`;
  const quote = getDailyQuote();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

  const stravaConnected = typeof document !== "undefined" && document.cookie.includes("oriwan_session");

  // 리커버리 영상 (러닝 회복 관련)
  const recoveryVideos = [
    { id: "dQw4w9WgXcQ", title: "러닝 후 스트레칭 루틴", duration: "8분" },
    { id: "nIoOHVq-m_w", title: "허벅지 폼롤러 마사지", duration: "10분" },
    { id: "g_tea8ZNk5A", title: "러너를 위한 요가", duration: "15분" },
  ];

  useEffect(() => {
    const init = async () => {
      // 인증 확인 (세션만 확인, DB 접근 안 함)
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push("/"); return; }

      setUser({
        name: u.user_metadata?.full_name || u.email?.split("@")[0] || "러너",
        avatar: u.user_metadata?.avatar_url || "",
      });

      // 서버 API로 완료 기록 조회 (DB 직접 접근 제거)
      try {
        const res = await fetch(`/api/completions?year=${year}&month=${month + 1}`);
        const data = await res.json();
        if (data.completions) {
          setCompletions(data.completions);
          setTodayDone(data.completions.some((d: CompletionData) => d.completed_date === todayStr));
        }
      } catch (err) {
        console.error("Failed to fetch completions:", err);
      }
    };
    init();
  }, [router, year, month, todayStr]);

  const completedDates = new Set(completions.map((c) => c.completed_date));

  const handleRecord = async () => {
    if (todayDone || loading) return;
    if (!stravaConnected) {
      window.location.href = "/api/auth/strava";
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

  const fetchRecoveryTip = async () => {
    if (recoveryLoading) return;
    setRecoveryLoading(true);
    try {
      const res = await fetch("/api/ai/recovery", { method: "POST" });
      const data = await res.json();
      setRecoveryTip(data.tip || "충분한 수분 섭취와 가벼운 스트레칭으로 근육 회복을 도와주세요.");
    } catch {
      setRecoveryTip("충분한 수분 섭취와 가벼운 스트레칭으로 근육 회복을 도와주세요.");
    }
    setRecoveryLoading(false);
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
            <Image src="/oriwan-logo-v2.png" alt="오리완" width={26} height={26} className="object-contain" />
            <h1 className="text-base font-extrabold gradient-text">오리완</h1>
          </div>
          <div className="flex items-center gap-2">
            {user?.avatar && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={user.avatar} alt="" width={24} height={24} className="rounded-full" />
            )}
            <button onClick={handleLogout} className="text-xs text-oriwan-text-muted hover:text-oriwan-text transition-colors">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full space-y-4 pb-8">
        {/* 명언 */}
        <div className="card-warm p-4 text-center animate-fade-up">
          <p className="text-sm text-oriwan-text leading-relaxed font-medium">
            &ldquo;{quote}&rdquo;
          </p>
        </div>

        {/* 달력 */}
        <div className="card p-4 animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-oriwan-text">{year}년 {monthNames[month]}</h3>
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
                    done ? "stamp-complete shadow-sm"
                      : isToday ? "stamp-today font-bold text-oriwan-primary"
                      : isFuture ? "text-oriwan-text-muted/25"
                      : "text-oriwan-text-muted/50"
                  }`}
                >
                  {done ? <IconCheck size={14} /> : day}
                </div>
              );
            })}
          </div>
        </div>

        {/* 기록 버튼 */}
        <div className="card p-5 text-center animate-fade-up" style={{ animationDelay: "0.1s" }}>
          {todayDone ? (
            <div className="space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-oriwan-success/15 flex items-center justify-center animate-float">
                <IconCheck size={28} className="text-oriwan-success" />
              </div>
              <h3 className="font-extrabold text-base gradient-text">오늘의 오리완 완료!</h3>
              <p className="text-xs text-oriwan-text-muted">잘했어요! 내일도 함께 달려요</p>
            </div>
          ) : (
            <button onClick={handleRecord} disabled={loading} className="btn-primary w-full py-3.5 text-sm">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  동기화 중...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <IconRun size={18} />
                  오늘의 러닝 기록하기
                </span>
              )}
            </button>
          )}
        </div>

        {/* 리커버리 콘텐츠 */}
        <div className="card p-4 animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center gap-2 mb-3">
            <IconDna size={16} className="text-oriwan-primary" />
            <h3 className="text-sm font-bold">리커버리 콘텐츠</h3>
          </div>

          {recoveryTip ? (
            <div className="bg-oriwan-surface-light rounded-2xl p-3 mb-3">
              <p className="text-xs text-oriwan-text leading-relaxed">{recoveryTip}</p>
            </div>
          ) : (
            <button
              onClick={fetchRecoveryTip}
              disabled={recoveryLoading}
              className="w-full bg-oriwan-surface-light hover:bg-oriwan-border/40 rounded-2xl p-3 mb-3 transition-colors text-left"
            >
              <p className="text-xs text-oriwan-text-muted">
                {recoveryLoading ? "AI가 분석 중..." : "AI 회복 팁 받기 →"}
              </p>
            </button>
          )}

          {/* 추천 영상 */}
          <div className="flex items-center gap-2 mb-2">
            <IconSprout size={14} className="text-oriwan-primary" />
            <h4 className="text-xs font-bold text-oriwan-text-muted">추천 영상</h4>
          </div>
          <div className="space-y-2">
            {recoveryVideos.map((v) => (
              <a
                key={v.id}
                href={`https://www.youtube.com/watch?v=${v.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-oriwan-surface-light hover:bg-oriwan-border/40 rounded-xl p-2.5 transition-colors"
              >
                <div className="w-16 h-10 rounded-lg bg-oriwan-border/60 flex-shrink-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`}
                    alt={v.title}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-oriwan-text truncate">{v.title}</p>
                  <p className="text-[10px] text-oriwan-text-muted">{v.duration}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
