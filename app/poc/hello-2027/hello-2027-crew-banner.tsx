"use client";

import Image from "next/image";
import { getCrewGoals } from "@/lib/crew-goals";
import { useRef, useState, type CSSProperties } from "react";
import { getCrewBannerPeriod, getCrewBannerStats, getCrewRunnerCount, HEALING_BANNER_IMAGE } from "@/lib/hello-2027-crew-banner";
import { useHealingBannerMotion } from "./use-healing-banner-motion";
import { useGangnamWeather } from "./use-gangnam-weather";
import type { BannerWeatherCondition } from "@/lib/gangnam-weather";
import { getHealingRoutePoint, healingRouteTransform, HEALING_RUNNERS, HEALING_RUNNER_ROUTE, HEALING_STRIDE_SECONDS, HEALING_TRAVEL_SECONDS } from "@/lib/healing-runner-route";
import styles from "./hello-2027-crew-banner.module.css";

type Hello2027CrewBannerProps = {
  crewGoalDistanceKm?: number;
  completedToday: number;
  participantCount: number;
  dayPhase?: string;
  active?: boolean;
  motionDisabled?: boolean;
  showMotionControl?: boolean;
  /** Only local preview controls supply a simulated condition. */
  weatherPreview?: BannerWeatherCondition;
  seasonDday?: string;
};

const ROUTE_STYLE = Object.fromEntries([
  ...HEALING_RUNNER_ROUTE.map(point => [`--route-${point.at}`, healingRouteTransform(point)]),
  ["--stride-duration", `${HEALING_STRIDE_SECONDS}s`],
  ["--travel-duration", `${HEALING_TRAVEL_SECONDS}s`],
]) as CSSProperties;

export function Hello2027CrewBanner({ completedToday, participantCount, dayPhase = "day", active = true, motionDisabled = false, showMotionControl = true, weatherPreview, seasonDday, crewGoalDistanceKm = 0 }: Hello2027CrewBannerProps) {
  const stats = getCrewBannerStats(completedToday, participantCount);
  const count = getCrewRunnerCount(completedToday, participantCount);
  // Retain already requested images so a lower count can fade out instead of
  // removing its <img> immediately. Initial 0% still requests no runner images.
  const [loadedRunnerCount, setLoadedRunnerCount] = useState(count);
  if (count > loadedRunnerCount) setLoadedRunnerCount(count);
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const motion = useHealingBannerMotion(root, active, motionDisabled || paused, count > 0, backgroundReady);
  const weather = useGangnamWeather(active && motion.inView && backgroundReady && !weatherPreview);
  const condition = weatherPreview ?? weather?.condition ?? "unknown";
  const period = getCrewBannerPeriod(dayPhase);
  return (
    <div ref={root} className={styles.banner} data-period={period} data-weather={condition} data-running={motion.running} data-enhanced={motion.enhanced} data-background-ready={backgroundReady} data-runner-count={count} data-motion-limited={motion.limited}>
      <div className={styles.artwork} aria-hidden="true">
        <div className={styles.scene} style={ROUTE_STYLE}>
          {/* Already compressed to 118KiB: use the CDN file directly, avoiding
              a cold image-optimizer request and oversized responsive variants. */}
          <Image src={HEALING_BANNER_IMAGE} alt="" fill unoptimized loading="eager" fetchPriority="high" className={styles.image} onLoad={() => setBackgroundReady(true)} />
          <div className={styles.waterShimmer} />
          {/* Far runners paint first; foreground runners then occlude them. */}
          {[...HEALING_RUNNERS].map((runner, i) => ({ runner, index: i })).reverse().map(({ runner, index: i }) => (
            <div key={i} className={styles.runnerPresence} data-visible={i < count}>
            <div className={styles.runner} data-runner-index={i} style={{ "--stride-delay": `${runner.strideDelay}s`, "--travel-delay": `${runner.travelDelay}s`, "--rest-transform": healingRouteTransform(getHealingRoutePoint(-runner.travelDelay / HEALING_TRAVEL_SECONDS * 100)) } as CSSProperties}>
              <div className={styles.runnerWindow}>
                {i < Math.max(count, loadedRunnerCount) ? (
                  // Sprite atlases retain their exact frame grid, without Next image resizing.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/images/poc/hello-2027/healing/runner-${runner.type}-${motion.enhanced ? "8" : "still"}.webp`}
                    alt="" width={motion.enhanced ? 1536 : 192} height={256}
                    className={motion.enhanced ? styles.runnerStrip : styles.runnerStill}
                    decoding="async" loading="lazy" fetchPriority="low"
                  />
                ) : null}
              </div>
            </div>
            </div>
          ))}
          <div className={styles.weatherCloud} />
          <div className={styles.weatherFog} />
          <div className={styles.precipitation}>
            {[8, 19, 31, 43, 52, 63, 74, 82, 91, 97].map((x, i) => (
              <i key={x} className={styles.weatherParticle} style={{ "--particle-x": `${x}%`, "--particle-delay": `${-i * 1.7}s` } as CSSProperties} />
            ))}
          </div>
          <div className={styles.eveningTint} />
          <div className={styles.nightTint} />
          <div className={styles.morningGlow} />
          <div className={styles.moon} />
          <div className={styles.stars} />
          <div className={styles.cloudDrift} />
        </div>
      </div>
      <div className={styles.wash} aria-hidden="true" />
      <div className={styles.content}>
        <p className={styles.eyebrow}>TWTT RUNNING CREW</p>
        <h2 className={styles.title}>오늘의 인증률</h2>
        <p className={styles.metric}><strong>{stats.rate}</strong><span>%</span></p>
        <div className={styles.progress} role="progressbar" aria-label="오늘의 크루 인증률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.rate} aria-valuetext={`${stats.rate}%, ${stats.description}`}>
          <span style={{ transform: `scaleX(${stats.rate / 100})` }} />
        </div>
        <p className={styles.description}>{stats.description}</p>
        {seasonDday && <p className={styles.seasonCountdown} aria-label={`2026년 12월 31일 기준 ${seasonDday}`}><strong>{seasonDday}</strong></p>}
      </div>
      <section className={styles.goals} aria-label="4기 공동 거리 목표">
        <p className={styles.goalsHeading}>함께 달성하는 4개의 목표</p>
        <p className={styles.goalsDistance}>공식 승인 러닝 {Math.max(0, Number.isFinite(crewGoalDistanceKm) ? crewGoalDistanceKm : 0).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}km</p>
        <ol className={styles.goalList}>
          {getCrewGoals(crewGoalDistanceKm).map(goal => (
            <li key={goal.step} data-state={goal.state} aria-label={`${goal.step}번째 목표: ${goal.state === "locked" ? "이전 목표 달성 후 공개" : `다 같이 ${goal.targetKm.toLocaleString("ko-KR")}km, ${goal.state === "completed" ? "달성 완료" : "도전 중"}`}`}>
              <span className={styles.goalMark} aria-hidden="true">{goal.state === "completed" ? "✓" : goal.step}</span>
              <span>{goal.state === "locked" ? "???" : `${goal.targetKm.toLocaleString("ko-KR")}km`}</span>
              <small>{goal.state === "completed" ? "달성" : goal.state === "locked" ? "미공개" : "도전 중"}</small>
            </li>
          ))}
        </ol>
      </section>
      {stats.total > 0 && stats.completed === stats.total ? <div key="completed" className={styles.completionGlow} aria-hidden="true" /> : null}
      {showMotionControl ? (
        <button className={styles.motionToggle} type="button" aria-label={paused ? "배너 모션 재생" : "배너 모션 일시정지"} aria-pressed={paused} disabled={motion.restricted || motion.limited} tabIndex={active ? 0 : -1} onClick={() => setPaused(value => !value)} title={motion.restricted || motion.limited ? "기기 설정과 성능에 맞춰 정지 화면을 표시합니다" : undefined}>
          <span className={paused ? styles.playIcon : styles.pauseIcon} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
