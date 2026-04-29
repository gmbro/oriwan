"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { IconCheck, IconRun } from "@/components/icons";

interface CompletionData { id: string; completed_date: string; }

const recovery = [
  { cat: "스트레칭", items: ["전신 스트레칭","하체 스트레칭","종아리 스트레칭","허벅지 스트레칭","고관절 풀기","엉덩이 스트레칭","햄스트링","발목 스트레칭","쿨다운 루틴","허리 스트레칭"] },
  { cat: "폼롤러", items: ["종아리 폼롤러","허벅지 폼롤러","IT밴드 풀기","등 폼롤러","엉덩이 폼롤러","전신 폼롤러","발바닥 마사지","폼롤러 입문","장경인대","대퇴사두근"] },
  { cat: "요가", items: ["러너 요가","러닝 후 요가","하체 유연성","고관절 오프너","15분 요가","아침 요가","수면 요가","코어 요가","릴랙스 요가","밸런스 요가"] },
  { cat: "부상 예방", items: ["무릎 보호","발목 강화","코어 운동","힙 강화","IT밴드 예방","족저근막 예방","밴드 운동","자세 교정","케이던스 업","체간 안정성"] },
  { cat: "영양 & 회복", items: ["러닝 식단","단백질 섭취","수분 보충","수면 질 향상","근육통 해소","아이스배스","마라톤 회복","탄수화물 로딩","보충제 가이드","마사지건"] },
];

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [completions, setCompletions] = useState<CompletionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [todayDone, setTodayDone] = useState(false);
  const [strava, setStrava] = useState(false);
  
  // 회복 팁 상태
  const [tip, setTip] = useState("");
  const [tipLoading, setTipLoading] = useState(false);
  const tipFetchedRef = useRef(false);

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

  const getTip = useCallback(() => {
    if (tipLoading) return;
    setTipLoading(true);
    setTip(""); // 로딩 효과를 위해 초기화
    fetch("/api/ai/recovery", { method: "POST" })
      .then(r => r.json())
      .then(d => setTip(d.tip || "가벼운 스트레칭과 수분 보충은 회복의 첫걸음입니다."))
      .catch(() => setTip("충분한 휴식과 스트레칭으로 내일의 러닝을 준비하세요."))
      .finally(() => setTipLoading(false));
  }, [tipLoading]);

  useEffect(() => {
    if (!mounted) return;
    const init = async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push("/"); return; }

      setUserName(u.user_metadata?.full_name || u.email?.split("@")[0] || "러너");
      setUserAvatar(u.user_metadata?.avatar_url || "");
      setStrava(document.cookie.includes("oriwan_session"));

      // 팁을 한 번만 자동 생성 (마운트 시)
      if (!tipFetchedRef.current) {
        tipFetchedRef.current = true;
        getTip();
      }

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
  }, [mounted, router, dateInfo.year, dateInfo.month, dateInfo.todayStr, getTip]);

  const monthNames = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
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
        if (d.activities && d.activities.length > 0) router.push("/success");
        else alert("오늘 Strava에 기록된 러닝이 없어요!\n달린 후 앱이나 워치를 동기화해주세요.");
      })
      .catch(() => alert("데이터 불러오기 실패. 잠시 후 다시 시도해주세요."))
      .finally(() => setLoading(false));
  }, [todayDone, loading, strava, router]);

  const handleLogout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST" }).then(() => { router.push("/"); router.refresh(); });
  }, [router]);

  if (!mounted) return <div className="min-h-screen bg-oriwan-bg" />;

  return (
    <div className="min-h-screen bg-oriwan-bg flex flex-col font-sans">
      <header className="sticky top-0 z-50 px-5 py-4 bg-oriwan-bg/80 backdrop-blur-xl border-b border-oriwan-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-white shadow-sm border border-black/5">
              <Image src="/oriwan-logo-v2.png" alt="오리완" width={28} height={28} className="object-cover" />
            </div>
            <h1 className="text-base font-bold text-oriwan-text tracking-tight">오리완</h1>
          </div>
          <div className="flex items-center gap-3">
            {userAvatar && <img src={userAvatar} alt="" width={28} height={28} className="rounded-full shadow-sm border border-black/5" />}
            <button onClick={handleLogout} className="text-[13px] font-medium text-oriwan-text-muted hover:text-oriwan-text transition-colors">로그아웃</button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 py-6 max-w-lg mx-auto w-full space-y-5 pb-12">
        {/* 명언 형태의 AI 회복 팁 버튼 */}
        <button onClick={getTip} disabled={tipLoading} className="w-full card-quote p-6 text-center animate-fade-up block">
          {tipLoading ? (
            <p className="text-[15px] text-oriwan-text-muted font-medium animate-pulse">새로운 회복 팁을 찾는 중...</p>
          ) : (
            <div className="space-y-2">
              <p className="text-[15px] text-oriwan-text leading-relaxed font-semibold tracking-tight">
                &ldquo;{tip || `${userName}님, 오늘의 회복 팁을 받아보세요!`}&rdquo;
              </p>
              <p className="text-[11px] text-oriwan-text-muted/60 font-medium tracking-wide">클릭하여 다른 팁 보기</p>
            </div>
          )}
        </button>

        {/* 달력 */}
        <div className="card p-5 animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-oriwan-text tracking-tight">{dateInfo.year}년 {monthNames[dateInfo.month]}</h3>
            <span className="text-[12px] text-oriwan-primary font-bold bg-oriwan-surface-light px-2.5 py-1 rounded-lg">
              {completions.length}일 완료
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {["일","월","화","수","목","금","토"].map((d,i) => (
              <div key={d} className={`text-center text-[11px] font-bold py-1 ${i===0?"text-oriwan-danger":i===6?"text-oriwan-accent":"text-oriwan-text-muted"}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-5">
            {Array.from({length: dateInfo.firstDay}).map((_,i) => <div key={`e${i}`} />)}
            {Array.from({length: dateInfo.daysInMonth}).map((_,i) => {
              const day = i+1;
              const ds = `${dateInfo.year}-${String(dateInfo.month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const done = completedDates.has(ds);
              const isToday = day === dateInfo.todayDate;
              const future = day > dateInfo.todayDate;
              return (
                <div key={day} className={`aspect-square flex items-center justify-center rounded-[14px] text-[13px] font-bold transition-all ${done?"stamp-complete":""}${isToday&&!done?"stamp-today text-oriwan-primary":""}${!done&&!isToday?(future?"text-oriwan-text-muted/30":"text-oriwan-text-muted"):""}`}>
                  {done ? <IconCheck size={14} /> : day}
                </div>
              );
            })}
          </div>

          {/* 기록 버튼 */}
          {todayDone ? (
            <div className="text-center py-2 bg-oriwan-surface-light rounded-[16px]">
              <p className="font-bold text-[15px] text-oriwan-text tracking-tight">오늘의 오리완 완료!</p>
              <p className="text-[12px] text-oriwan-text-muted mt-0.5 font-medium">충분한 휴식을 취하세요</p>
            </div>
          ) : (
            <button onClick={handleRecord} disabled={loading} className="btn-primary w-full py-4 text-[15px]">
              {loading ? "동기화 중..." : (
                <span className="flex items-center justify-center gap-2.5">
                  <IconRun size={18} />
                  오늘의 러닝 기록하기
                </span>
              )}
            </button>
          )}
        </div>

        {/* 리커버리 영상 카테고리 (격자) */}
        {recovery.map((cat, ci) => (
          <div key={cat.cat} className="card p-5 animate-fade-up" style={{ animationDelay: `${0.1+ci*0.04}s` }}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[14px] font-bold text-oriwan-text tracking-tight">{cat.cat}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cat.items.map(item => (
                <a key={item} href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`러닝 ${item}`)}`} target="_blank" rel="noopener noreferrer"
                  className="bg-oriwan-surface-light hover:bg-black/5 active:bg-black/10 rounded-[14px] px-3 py-3 transition-colors text-center text-[13px] font-semibold text-oriwan-text">
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
