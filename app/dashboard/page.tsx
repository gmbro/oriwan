"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { IconCheck, IconRun, IconDna } from "@/components/icons";

interface CompletionData { id: string; completed_date: string; }

// 리커버리 콘텐츠 50개
const recovery = [
  { cat: "스트레칭", items: ["전신 스트레칭","하체 스트레칭","종아리 스트레칭","허벅지 스트레칭","고관절 풀기","엉덩이 스트레칭","햄스트링","발목 스트레칭","쿨다운 루틴","허리 스트레칭"] },
  { cat: "폼롤러", items: ["종아리 폼롤러","허벅지 폼롤러","IT밴드 풀기","등 폼롤러","엉덩이 폼롤러","전신 폼롤러","발바닥 마사지","폼롤러 입문","장경인대","대퇴사두근"] },
  { cat: "요가", items: ["러너 요가","러닝 후 요가","하체 유연성","고관절 오프너","15분 요가","아침 요가","수면 요가","코어 요가","릴랙스 요가","밸런스 요가"] },
  { cat: "부상 예방", items: ["무릎 보호","발목 강화","코어 운동","힙 강화","IT밴드 예방","족저근막 예방","밴드 운동","자세 교정","케이던스 업","체간 안정성"] },
  { cat: "영양 & 회복", items: ["러닝 식단","단백질 섭취","수분 보충","수면 질 향상","근육통 해소","아이스배스","마라톤 회복","탄수화물 로딩","보충제 가이드","마사지건"] },
];

const catColors = ["#6366F1","#22C55E","#F97316","#EC4899","#8B5CF6"];

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [completions, setCompletions] = useState<CompletionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [todayDone, setTodayDone] = useState(false);
  const [strava, setStrava] = useState(false);
  const [tip, setTip] = useState("");
  const [tipLoading, setTipLoading] = useState(false);

  // 날짜 관련 — 클라이언트에서만 계산 (hydration 방지)
  const [dateInfo, setDateInfo] = useState({ year: 2026, month: 3, todayDate: 29, todayStr: "2026-04-29", daysInMonth: 30, firstDay: 3 });

  useEffect(() => {
    setMounted(true);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    setDateInfo({
      year: y, month: m, todayDate: d,
      todayStr: `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,
      daysInMonth: new Date(y, m+1, 0).getDate(),
      firstDay: new Date(y, m, 1).getDay(),
    });
  }, []);

  const monthNames = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

  useEffect(() => {
    if (!mounted) return;
    const init = async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push("/"); return; }

      setUserName(u.user_metadata?.full_name || u.email?.split("@")[0] || "러너");
      setUserAvatar(u.user_metadata?.avatar_url || "");
      setStrava(document.cookie.includes("oriwan_session"));

      try {
        const res = await fetch(`/api/completions?year=${dateInfo.year}&month=${dateInfo.month+1}`);
        if (res.ok) {
          const data = await res.json();
          if (data.completions) {
            setCompletions(data.completions);
            setTodayDone(data.completions.some((c: CompletionData) => c.completed_date === dateInfo.todayStr));
          }
        }
      } catch {}
    };
    init();
  }, [mounted, router, dateInfo.year, dateInfo.month, dateInfo.todayStr]);

  const completedDates = new Set(completions.map(c => c.completed_date));

  const handleRecord = useCallback(() => {
    if (todayDone || loading) return;
    if (!strava) {
      window.location.href = "/api/auth/strava";
      return;
    }
    setLoading(true);
    fetch("/api/strava/activities")
      .then(r => r.json())
      .then(d => {
        if (d.activities?.length > 0) router.push("/success");
        else alert("오늘 Strava에 기록된 러닝이 없어요!\n달리고 다시 눌러주세요.");
      })
      .catch(() => alert("데이터 불러오기 실패"))
      .finally(() => setLoading(false));
  }, [todayDone, loading, strava, router]);

  const getTip = useCallback(() => {
    if (tipLoading) return;
    setTipLoading(true);
    fetch("/api/ai/recovery", { method: "POST" })
      .then(r => r.json())
      .then(d => setTip(d.tip || "달린 후에는 충분한 수분 보충과 가벼운 스트레칭이 좋아요."))
      .catch(() => setTip("달린 후에는 충분한 수분 보충과 가벼운 스트레칭이 좋아요."))
      .finally(() => setTipLoading(false));
  }, [tipLoading]);

  const handleLogout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST" }).then(() => { router.push("/"); router.refresh(); });
  }, [router]);

  if (!mounted) return <div className="min-h-screen bg-oriwan-bg" />;

  return (
    <div className="min-h-screen bg-oriwan-bg flex flex-col">
      <header className="sticky top-0 z-50 px-4 py-3 bg-oriwan-bg/90 backdrop-blur-md border-b border-oriwan-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/oriwan-logo-v2.png" alt="오리완" width={26} height={26} className="object-contain" />
            <h1 className="text-base font-extrabold gradient-text">오리완</h1>
          </div>
          <div className="flex items-center gap-2">
            {userAvatar && <img src={userAvatar} alt="" width={24} height={24} className="rounded-full" />}
            <button onClick={handleLogout} className="text-xs text-oriwan-text-muted hover:text-oriwan-text transition-colors">로그아웃</button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full space-y-3 pb-8">
        {/* AI 회복 팁 */}
        <div className="card p-4 animate-fade-up">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <IconDna size={14} className="text-oriwan-primary" />
              <h3 className="text-xs font-bold text-oriwan-text">AI 회복 팁</h3>
            </div>
            <button onClick={getTip} disabled={tipLoading} className="text-[11px] text-oriwan-primary font-semibold hover:underline">
              {tipLoading ? "생성 중..." : tip ? "다른 팁 보기" : "팁 받기"}
            </button>
          </div>
          <p className="text-sm text-oriwan-text leading-relaxed">
            {tip || `${userName}님, 오늘도 좋은 하루 보내세요! AI 회복 팁을 받아보세요.`}
          </p>
        </div>

        {/* 달력 + 기록 */}
        <div className="card p-4 animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">{dateInfo.year}년 {monthNames[dateInfo.month]}</h3>
            <span className="text-[11px] text-oriwan-primary font-bold bg-oriwan-surface-light px-2 py-0.5 rounded-full">
              {completions.length}일 완료
            </span>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {["일","월","화","수","목","금","토"].map((d,i) => (
              <div key={d} className={`text-center text-[10px] font-semibold py-0.5 ${i===0?"text-oriwan-danger":i===6?"text-blue-400":"text-oriwan-text-muted"}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-4">
            {Array.from({length: dateInfo.firstDay}).map((_,i) => <div key={`e${i}`} />)}
            {Array.from({length: dateInfo.daysInMonth}).map((_,i) => {
              const day = i+1;
              const ds = `${dateInfo.year}-${String(dateInfo.month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const done = completedDates.has(ds);
              const isToday = day === dateInfo.todayDate;
              const future = day > dateInfo.todayDate;
              return (
                <div key={day} className={`aspect-square flex items-center justify-center rounded-lg text-[11px] font-semibold ${done?"stamp-complete":""}${isToday&&!done?"stamp-today text-oriwan-primary":""}${!done&&!isToday?(future?"text-oriwan-text-muted/20":"text-oriwan-text-muted/50"):""}`}>
                  {done ? <IconCheck size={12} /> : day}
                </div>
              );
            })}
          </div>

          {todayDone ? (
            <div className="text-center py-1">
              <p className="font-bold text-sm gradient-text">오늘의 오리완 완료!</p>
              <p className="text-[11px] text-oriwan-text-muted mt-0.5">내일도 함께 달려요</p>
            </div>
          ) : (
            <button onClick={handleRecord} disabled={loading} className="btn-primary w-full py-3 text-sm">
              {loading ? "동기화 중..." : (
                <span className="flex items-center justify-center gap-2">
                  <IconRun size={16} />
                  오늘의 러닝 기록하기
                </span>
              )}
            </button>
          )}
        </div>

        {/* 리커버리 콘텐츠 50개 격자형 */}
        {recovery.map((cat, ci) => (
          <div key={cat.cat} className="card p-4 animate-fade-up" style={{ animationDelay: `${0.1+ci*0.03}s` }}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColors[ci] }} />
              <h3 className="text-xs font-bold">{cat.cat}</h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {cat.items.map(item => (
                <a key={item} href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`러닝 ${item}`)}`} target="_blank" rel="noopener noreferrer"
                  className="bg-oriwan-surface-light hover:bg-oriwan-border/50 rounded-xl px-3 py-2.5 transition-all text-center text-xs font-medium text-oriwan-text hover:text-oriwan-primary">
                  {item}
                </a>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
