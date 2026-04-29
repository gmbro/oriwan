"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { IconCheck, IconRun } from "@/components/icons";

interface CompletionData { id: string; completed_date: string; }

const recovery = [
  { cat: "러닝 후 스트레칭", items: ["전신 스트레칭","하체 스트레칭","종아리 스트레칭","허벅지 스트레칭","고관절 풀기","엉덩이 스트레칭","햄스트링","발목 스트레칭","쿨다운 루틴","허리 스트레칭"] },
  { cat: "폼롤러 마사지", items: ["종아리 폼롤러","허벅지 폼롤러","IT밴드 풀기","등 폼롤러","엉덩이 폼롤러","전신 폼롤러","발바닥 마사지","폼롤러 입문","장경인대","대퇴사두근"] },
  { cat: "러너 요가", items: ["러너 요가","러닝 후 요가","하체 유연성","고관절 오프너","15분 요가","아침 요가","수면 요가","코어 요가","릴랙스 요가","밸런스 요가"] },
  { cat: "부상 예방 & 근력", items: ["무릎 보호","발목 강화","코어 운동","힙 강화","IT밴드 예방","족저근막 예방","밴드 운동","자세 교정","케이던스 업","체간 안정성"] },
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

  // ★ 핵심: Strava 연동 상태를 서버 API로 확인 (httpOnly 쿠키 문제 해결)
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaChecked, setStravaChecked] = useState(false);

  // 회복 팁
  const [tip, setTip] = useState("");
  const [tipLoading, setTipLoading] = useState(false);
  const tipLoadedRef = useRef(false);

  // 날짜 (hydration 안전)
  const [dateInfo, setDateInfo] = useState({
    year: 2026, month: 3, todayDate: 29,
    todayStr: "2026-04-29", daysInMonth: 30, firstDay: 3,
  });

  // 마운트 시 날짜 계산
  useEffect(() => {
    setMounted(true);
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    setDateInfo({
      year: y, month: m, todayDate: d,
      todayStr: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      daysInMonth: new Date(y, m + 1, 0).getDate(),
      firstDay: new Date(y, m, 1).getDay(),
    });
  }, []);

  // AI 회복 팁 가져오기
  const fetchTip = useCallback(() => {
    if (tipLoading) return;
    setTipLoading(true);
    fetch("/api/ai/recovery", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setTip(d.tip || "가벼운 워킹과 스트레칭으로 근육 회복을 시작하세요."))
      .catch(() => setTip("가벼운 워킹과 스트레칭으로 근육 회복을 시작하세요."))
      .finally(() => setTipLoading(false));
  }, [tipLoading]);

  // 초기화
  useEffect(() => {
    if (!mounted) return;

    const init = async () => {
      // 1. Supabase 인증 확인
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push("/"); return; }

      setUserName(u.user_metadata?.full_name || u.email?.split("@")[0] || "러너");
      setUserAvatar(u.user_metadata?.avatar_url || "");

      // 2. ★ Strava 연동 상태를 서버 API로 확인 (document.cookie 사용 안 함!)
      try {
        const stravaRes = await fetch("/api/auth/strava/status");
        const stravaData = await stravaRes.json();
        setStravaConnected(stravaData.connected);
      } catch {
        setStravaConnected(false);
      }
      setStravaChecked(true);

      // 3. 완료 기록 조회
      try {
        const res = await fetch(`/api/completions?year=${dateInfo.year}&month=${dateInfo.month + 1}`);
        if (res.ok) {
          const data = await res.json();
          if (data.completions) {
            setCompletions(data.completions);
            setTodayDone(data.completions.some((c: CompletionData) => c.completed_date === dateInfo.todayStr));
          }
        }
      } catch {}

      // 4. AI 팁 최초 1회 자동 로딩
      if (!tipLoadedRef.current) {
        tipLoadedRef.current = true;
        fetch("/api/ai/recovery", { method: "POST" })
          .then((r) => r.json())
          .then((d) => setTip(d.tip || "달린 후에는 스트레칭과 충분한 수분 보충이 중요해요."))
          .catch(() => setTip("달린 후에는 스트레칭과 충분한 수분 보충이 중요해요."));
      }
    };

    init();
  }, [mounted, router, dateInfo.year, dateInfo.month, dateInfo.todayStr]);

  const monthNames = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const completedDates = new Set(completions.map((c) => c.completed_date));

  // ★ 기록 버튼 핸들러 — Strava 미연동 시 명확한 안내
  const handleRecord = useCallback(() => {
    if (todayDone || loading) return;

    if (!stravaConnected) {
      // Strava 미연동 → Strava 인증 페이지로 이동
      if (confirm("Strava 연동이 필요합니다.\n연동 페이지로 이동할까요?")) {
        window.location.href = "/api/auth/strava";
      }
      return;
    }

    // Strava 연동 완료 → 오늘 활동 조회
    setLoading(true);
    fetch("/api/strava/activities")
      .then((r) => r.json())
      .then((d) => {
        if (d.activities && d.activities.length > 0) {
          router.push("/success");
        } else {
          alert("오늘 Strava에 기록된 러닝이 없어요!\n달린 후 워치를 동기화하고 다시 시도해주세요.");
        }
      })
      .catch(() => alert("데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요."))
      .finally(() => setLoading(false));
  }, [todayDone, loading, stravaConnected, router]);

  const handleLogout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST" }).then(() => {
      router.push("/");
      router.refresh();
    });
  }, [router]);

  if (!mounted) return <div className="min-h-screen bg-oriwan-bg" />;

  return (
    <div className="min-h-screen bg-oriwan-bg flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 px-4 py-3 bg-oriwan-bg/90 backdrop-blur-xl border-b border-oriwan-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden">
              <Image src="/oriwan-logo-v2.png" alt="오리완" width={28} height={28} className="object-cover" />
            </div>
            <h1 className="text-base font-extrabold gradient-text">오리완</h1>
          </div>
          <div className="flex items-center gap-2.5">
            {userAvatar && (
              <img src={userAvatar} alt="" width={26} height={26} className="rounded-full border border-oriwan-border" />
            )}
            <button onClick={handleLogout} className="text-xs text-oriwan-text-muted hover:text-oriwan-text transition-colors font-medium">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4 pb-10">

        {/* Strava 미연동 배너 */}
        {stravaChecked && !stravaConnected && (
          <div className="animate-fade-up">
            <button
              onClick={() => { window.location.href = "/api/auth/strava"; }}
              className="btn-strava w-full py-3.5 text-sm"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
              Strava 연동하기
            </button>
          </div>
        )}

        {/* AI 회복 팁 — 명언 형태, 클릭하면 새 팁 */}
        <button
          onClick={fetchTip}
          disabled={tipLoading}
          className="w-full card-quote p-5 text-center animate-fade-up block"
          style={{ animationDelay: "0.03s" }}
        >
          {tipLoading ? (
            <p className="text-sm text-oriwan-text-muted animate-pulse">새로운 회복 팁을 찾는 중...</p>
          ) : (
            <div>
              <p className="text-[14px] text-oriwan-text leading-[1.7] font-medium px-2 whitespace-pre-line text-balance">
                &ldquo;{tip || "러닝 후 회복 팁을\n클릭해서 받아보세요"}&rdquo;
              </p>
              <p className="text-[11px] text-oriwan-primary/50 font-medium mt-3">탭하여 다른 팁 보기</p>
            </div>
          )}
        </button>

        {/* 달력 + 기록 버튼 */}
        <div className="card p-5 animate-fade-up" style={{ animationDelay: "0.06s" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">{dateInfo.year}년 {monthNames[dateInfo.month]}</h3>
            <span className="text-[11px] text-oriwan-primary font-bold bg-blue-50 px-2.5 py-1 rounded-full">
              {completions.length}일 완료
            </span>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {["일","월","화","수","목","금","토"].map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-bold py-0.5 ${i === 0 ? "text-oriwan-danger" : i === 6 ? "text-oriwan-primary" : "text-oriwan-text-muted"}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 mb-4">
            {Array.from({ length: dateInfo.firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: dateInfo.daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds = `${dateInfo.year}-${String(dateInfo.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const done = completedDates.has(ds);
              const isToday = day === dateInfo.todayDate;
              const future = day > dateInfo.todayDate;
              return (
                <div
                  key={day}
                  className={`aspect-square flex items-center justify-center rounded-xl text-[12px] font-semibold transition-all
                    ${done ? "stamp-complete" : ""}
                    ${isToday && !done ? "stamp-today text-oriwan-primary font-bold" : ""}
                    ${!done && !isToday ? (future ? "text-oriwan-text-muted/25" : "text-oriwan-text-muted/50") : ""}
                  `}
                >
                  {done ? <IconCheck size={13} /> : day}
                </div>
              );
            })}
          </div>

          {/* 기록 버튼 */}
          {todayDone ? (
            <div className="text-center py-3 bg-blue-50 rounded-2xl">
              <p className="font-bold text-sm gradient-text">오늘의 오리완 완료!</p>
              <p className="text-[11px] text-oriwan-text-muted mt-0.5">충분한 휴식을 취하세요</p>
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
                  <IconRun size={16} />
                  오늘의 러닝 기록하기
                </span>
              )}
            </button>
          )}
        </div>

        {/* 리커버리 콘텐츠 — 토글(접기/펼치기) */}
        <div className="animate-fade-up" style={{ animationDelay: "0.09s" }}>
          <h2 className="text-sm font-bold text-oriwan-text mb-2 px-1">리커버리 콘텐츠</h2>

          <div className="space-y-2">
            {recovery.map((cat) => (
              <details key={cat.cat} className="card toggle-section overflow-hidden">
                <summary className="flex items-center justify-between p-4 hover:bg-oriwan-surface-light transition-colors">
                  <span className="text-[13px] font-bold text-oriwan-text">{cat.cat}</span>
                  <svg className="toggle-chevron w-4 h-4 text-oriwan-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </summary>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-1.5">
                    {cat.items.map((item) => (
                      <a
                        key={item}
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`러닝 ${item}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-oriwan-surface-light hover:bg-blue-50 active:bg-blue-100 rounded-xl px-3 py-2.5 transition-colors text-center text-[12px] font-medium text-oriwan-text hover:text-oriwan-primary"
                      >
                        {item}
                      </a>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
