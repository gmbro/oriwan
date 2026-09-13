"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { getSeoulBannerPeriod, type BannerWeatherCondition } from "@/lib/gangnam-weather";
import { Hello2027BannerCarousel } from "@/app/poc/hello-2027/hello-2027-banner-carousel";
import dashboardStyles from "@/app/poc/hello-2027/hello-2027-poc.module.css";
import styles from "./preview.module.css";

function subscribeClock(onChange: () => void) {
  const interval = window.setInterval(() => { if (!document.hidden) onChange(); }, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onChange); };
}
const serverPeriod = () => "day";

export function CrewBannerPreview({ note }: { note: ReactNode }) {
  const [completed, setCompleted] = useState(17);
  const [width, setWidth] = useState(0);
  const [period, setPeriod] = useState("live");
  const livePeriod = useSyncExternalStore(subscribeClock, getSeoulBannerPeriod, serverPeriod);
  const [weatherMode, setWeatherMode] = useState<"live" | BannerWeatherCondition>("live");
  const [staticMode, setStaticMode] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [measurement, setMeasurement] = useState("");
  const [popupTime, setPopupTime] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  const measure = () => {
    setMeasuring(true);
    const samples: number[] = [];
    let previous = 0;
    const start = performance.now();
    let longTasks = 0;
    const observer = PerformanceObserver.supportedEntryTypes.includes("longtask")
      ? new PerformanceObserver(list => { longTasks += list.getEntries().length; }) : null;
    observer?.observe({ type: "longtask" });
    const sample = (now: number) => {
      if (previous) samples.push(now - previous);
      previous = now;
      if (now - start < 4000) requestAnimationFrame(sample);
      else {
        observer?.disconnect();
        const sorted = [...samples].sort((a, b) => a - b);
        const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        setMeasurement(`${staticMode ? "정지" : "모션"}: ${samples.length} 프레임 · 평균 ${average.toFixed(1)}ms · P95 ${(sorted[Math.floor(sorted.length * .95)] ?? 0).toFixed(1)}ms · 50ms 초과 ${samples.filter(value => value > 50).length}회 · 긴 작업 ${longTasks}회`);
        setMeasuring(false);
      }
    };
    requestAnimationFrame(sample);
  };

  return (
    <main className={`${dashboardStyles.page} ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <p>LOCAL DESIGN PREVIEW</p>
          <h1>우리 크루의 오늘</h1>
          <span>첨부한 티셔츠와 크루 사진을 반영한 최종 배너 · 아래 수치는 미리보기용 예시입니다.</span>
        </div>
        <div className={styles.controls}>
          <label>인증률 예시
            <select value={completed} onChange={(event) => setCompleted(Number(event.target.value))}>
              <option value={0}>0% · 첫 인증 전</option>
              <option value={17}>68% · 17/25명</option>
              <option value={25}>100% · 전원 인증</option>
            </select>
          </label>
          <label>화면 크기
            <select value={width} onChange={(event) => setWidth(Number(event.target.value))}>
              <option value={0}>현재 화면에 맞춤</option>
              <option value={390}>모바일 · 390px</option>
              <option value={320}>작은 모바일 · 320px</option>
            </select>
          </label>
          <label>시간대
            <select value={period} onChange={event => setPeriod(event.target.value)}>
              <option value="live">서울 현재 시간</option>
              <option value="morning">아침</option>
              <option value="day">점심</option>
              <option value="evening">저녁</option>
              <option value="night">밤</option>
            </select>
          </label>
          <label>날씨
            <select value={weatherMode} onChange={event => setWeatherMode(event.target.value as "live" | BannerWeatherCondition)}>
              <option value="live">강남구 실제 예보</option>
              <option value="clear">맑음 · 연출 예시</option>
              <option value="cloudy">구름 · 연출 예시</option>
              <option value="fog">안개 · 연출 예시</option>
              <option value="rain">비 · 연출 예시</option>
              <option value="snow">눈 · 연출 예시</option>
            </select>
          </label>
        </div>
      </header>
      <div className={styles.frame} style={{ maxWidth: width || 1440 }}>
        <Hello2027BannerCarousel
          ads={[]}
          dayPhase={period === "live" ? livePeriod : period}
          weatherPreview={weatherMode === "live" ? undefined : weatherMode}
          motionDisabled={staticMode}
          completedToday={completed}
          participantCount={25}
        />
      </div>
      <div className={styles.testControls}>
        <label><input type="checkbox" checked={staticMode} onChange={event => setStaticMode(event.target.checked)} /> 정지 화면 비교</label>
        <button type="button" disabled={measuring} onClick={measure}>{measuring ? "4초 측정 중" : "프레임 성능 측정"}</button>
        <button type="button" onClick={() => {
          const start = performance.now();
          dialog.current?.showModal();
          requestAnimationFrame(() => requestAnimationFrame(() => setPopupTime(`팝업 표시 ${(performance.now() - start).toFixed(1)}ms`)));
        }}>팝업 반응 테스트</button>
        <output aria-live="polite">{measurement}</output>
        <small>로컬 프레임 간격 비교용입니다. 실제 사용자 INP/LCP 측정을 대체하지 않습니다.</small>
      </div>
      <dialog ref={dialog} className={styles.dialog}>
        <h2>잠깐 쉬어가요</h2>
        <p>팝업을 보는 동안 배너의 움직임은 멈춥니다.</p>
        <output>{popupTime}</output>
        <button type="button" onClick={() => dialog.current?.close()}>닫기</button>
      </dialog>
      {note}
    </main>
  );
}
