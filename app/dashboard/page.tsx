"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { IconCheck, IconRun, IconDna } from "@/components/icons";
import { getDailyQuote } from "@/lib/quotes";

interface CompletionData {
  id: string;
  completed_date: string;
}

// 러닝 리커버리 영상 50개 (유튜브 검색 링크 — 비용 0원)
const recoveryCategories = [
  {
    title: "러닝 후 스트레칭",
    videos: [
      { q: "러닝 후 전신 스트레칭", label: "전신 스트레칭" },
      { q: "러닝 후 하체 스트레칭", label: "하체 스트레칭" },
      { q: "달리기 후 종아리 스트레칭", label: "종아리 스트레칭" },
      { q: "러닝 후 허벅지 스트레칭", label: "허벅지 스트레칭" },
      { q: "러닝 후 고관절 스트레칭", label: "고관절 풀기" },
      { q: "러닝 후 엉덩이 스트레칭", label: "엉덩이 스트레칭" },
      { q: "러닝 후 햄스트링 스트레칭", label: "햄스트링" },
      { q: "러닝 후 발목 스트레칭", label: "발목 스트레칭" },
      { q: "러닝 후 쿨다운 루틴", label: "쿨다운 루틴" },
      { q: "달리기 후 허리 스트레칭", label: "허리 스트레칭" },
    ],
  },
  {
    title: "폼롤러 마사지",
    videos: [
      { q: "종아리 폼롤러 마사지", label: "종아리 폼롤러" },
      { q: "허벅지 폼롤러 마사지", label: "허벅지 폼롤러" },
      { q: "IT밴드 폼롤러 마사지", label: "IT밴드 풀기" },
      { q: "등 폼롤러 마사지", label: "등 폼롤러" },
      { q: "엉덩이 폼롤러 마사지", label: "엉덩이 폼롤러" },
      { q: "전신 폼롤러 루틴 러너", label: "전신 폼롤러" },
      { q: "발바닥 테니스공 마사지", label: "발바닥 마사지" },
      { q: "폼롤러 사용법 초보", label: "폼롤러 입문" },
      { q: "장경인대 폼롤러", label: "장경인대" },
      { q: "대퇴사두근 폼롤러", label: "대퇴사두근" },
    ],
  },
  {
    title: "러너 요가",
    videos: [
      { q: "러너를 위한 요가", label: "러너 요가" },
      { q: "달리기 후 요가 스트레칭", label: "러닝 후 요가" },
      { q: "하체 유연성 요가", label: "하체 유연성" },
      { q: "고관절 오프너 요가", label: "고관절 오프너" },
      { q: "초보 요가 15분", label: "15분 요가" },
      { q: "아침 요가 루틴 10분", label: "아침 요가" },
      { q: "밤 요가 수면 전", label: "수면 요가" },
      { q: "코어 강화 요가 러너", label: "코어 요가" },
      { q: "전신 릴랙스 요가", label: "릴랙스 요가" },
      { q: "균형감각 요가 러너", label: "밸런스 요가" },
    ],
  },
  {
    title: "부상 예방 & 근력",
    videos: [
      { q: "러너 무릎 부상 예방 운동", label: "무릎 보호" },
      { q: "발목 강화 운동 러너", label: "발목 강화" },
      { q: "러너 코어 운동", label: "코어 운동" },
      { q: "러너 엉덩이 근력 운동", label: "힙 강화" },
      { q: "장경인대 증후군 예방", label: "IT밴드 예방" },
      { q: "족저근막염 예방 운동", label: "족저근막 예방" },
      { q: "러너 밴드 운동 하체", label: "밴드 운동" },
      { q: "러닝 자세 교정", label: "자세 교정" },
      { q: "케이던스 높이는 방법", label: "케이던스 업" },
      { q: "러너 체간 안정성 운동", label: "체간 안정성" },
    ],
  },
  {
    title: "영양 & 회복",
    videos: [
      { q: "러닝 후 식단 추천", label: "러닝 식단" },
      { q: "러너 단백질 보충 방법", label: "단백질 섭취" },
      { q: "달리기 전 후 수분 보충", label: "수분 보충" },
      { q: "러너 수면 질 높이기", label: "수면 질 향상" },
      { q: "근육통 빠르게 풀기", label: "근육통 해소" },
      { q: "러닝 후 아이스배스", label: "아이스배스" },
      { q: "마라톤 회복 식단", label: "마라톤 회복" },
      { q: "러너 탄수화물 로딩", label: "탄수화물 로딩" },
      { q: "러닝 보충제 추천", label: "보충제 가이드" },
      { q: "러닝 후 마사지건 사용법", label: "마사지건" },
    ],
  },
];

// 카테고리별 색상
const catColors = ["#FF8C42", "#6DD47E", "#7C9CFF", "#FF6B8A", "#FFCE54"];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; avatar: string } | null>(null);
  const [completions, setCompletions] = useState<CompletionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [todayDone, setTodayDone] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
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
      setStravaConnected(document.cookie.includes("oriwan_session"));

      // 서버 API로 완료 기록 조회
      try {
        const res = await fetch(`/api/completions?year=${year}&month=${month + 1}`);
        if (res.ok) {
          const data = await res.json();
          if (data.completions) {
            setCompletions(data.completions);
            setTodayDone(data.completions.some((d: CompletionData) => d.completed_date === todayStr));
          }
        }
      } catch (err) {
        console.error("Failed to fetch completions:", err);
      }
    };
    init();
  }, [router, year, month, todayStr]);

  const completedDates = new Set(completions.map((c) => c.completed_date));

  const handleRecord = () => {
    if (todayDone || loading) return;
    if (!stravaConnected) {
      window.location.href = "/api/auth/strava";
      return;
    }
    setLoading(true);
    fetch("/api/strava/activities")
      .then((res) => res.json())
      .then((data) => {
        if (data.activities?.length > 0) {
          router.push("/success");
        } else {
          alert("오늘 Strava에 기록된 러닝이 없어요!\n달리고 다시 눌러주세요 :)");
        }
      })
      .catch(() => alert("데이터를 불러오는 중 오류가 발생했어요."))
      .finally(() => setLoading(false));
  };

  const fetchRecoveryTip = () => {
    if (recoveryLoading) return;
    setRecoveryLoading(true);
    fetch("/api/ai/recovery", { method: "POST" })
      .then((res) => res.json())
      .then((data) => setRecoveryTip(data.tip || "충분한 수분 섭취와 가벼운 스트레칭으로 회복하세요."))
      .catch(() => setRecoveryTip("충분한 수분 섭취와 가벼운 스트레칭으로 회복하세요."))
      .finally(() => setRecoveryLoading(false));
  };

  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST" }).then(() => {
      router.push("/");
      router.refresh();
    });
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
          <p className="text-sm text-oriwan-text leading-relaxed font-medium">&ldquo;{quote}&rdquo;</p>
        </div>

        {/* 달력 + 기록 버튼 */}
        <div className="card p-4 animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-oriwan-text">{year}년 {monthNames[month]}</h3>
            <span className="text-xs text-oriwan-primary font-bold bg-oriwan-surface-light px-2.5 py-1 rounded-full">
              {completions.length}일 완료
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {["일","월","화","수","목","금","토"].map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-semibold py-0.5 ${i === 0 ? "text-oriwan-danger" : i === 6 ? "text-blue-400" : "text-oriwan-text-muted"}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 mb-4">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const done = completedDates.has(dateStr);
              const isToday = day === todayDate;
              const isFuture = day > todayDate;
              return (
                <div key={day} className={`aspect-square flex items-center justify-center rounded-xl text-xs font-semibold transition-all ${done ? "stamp-complete shadow-sm" : isToday ? "stamp-today font-bold text-oriwan-primary" : isFuture ? "text-oriwan-text-muted/25" : "text-oriwan-text-muted/50"}`}>
                  {done ? <IconCheck size={14} /> : day}
                </div>
              );
            })}
          </div>

          {/* 기록 버튼 — 달력 바로 아래 */}
          {todayDone ? (
            <div className="text-center py-2">
              <h3 className="font-extrabold text-sm gradient-text">오늘의 오리완 완료!</h3>
              <p className="text-[11px] text-oriwan-text-muted mt-0.5">잘했어요! 내일도 함께 달려요</p>
            </div>
          ) : (
            <button onClick={handleRecord} disabled={loading} className="btn-primary w-full py-3 text-sm">
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

        {/* AI 리커버리 팁 */}
        <div className="card p-4 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2 mb-2">
            <IconDna size={16} className="text-oriwan-primary" />
            <h3 className="text-sm font-bold">AI 회복 팁</h3>
          </div>
          {recoveryTip ? (
            <div className="bg-oriwan-surface-light rounded-2xl p-3">
              <p className="text-xs text-oriwan-text leading-relaxed">{recoveryTip}</p>
            </div>
          ) : (
            <button onClick={fetchRecoveryTip} disabled={recoveryLoading} className="w-full bg-oriwan-surface-light hover:bg-oriwan-border/40 rounded-2xl p-3 transition-colors text-left">
              <p className="text-xs text-oriwan-text-muted">{recoveryLoading ? "AI가 분석 중..." : "오늘의 회복 팁 받기 →"}</p>
            </button>
          )}
        </div>

        {/* 리커버리 콘텐츠 — 카테고리별 격자형 */}
        {recoveryCategories.map((cat, ci) => (
          <div key={cat.title} className="card p-4 animate-fade-up" style={{ animationDelay: `${0.15 + ci * 0.03}s` }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catColors[ci] }} />
              <h3 className="text-sm font-bold">{cat.title}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cat.videos.map((v) => (
                <a
                  key={v.q}
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(v.q)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-oriwan-surface-light hover:bg-oriwan-border/40 rounded-xl p-3 transition-all hover:scale-[1.02] active:scale-[0.98] text-center"
                >
                  <p className="text-xs font-semibold text-oriwan-text">{v.label}</p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
