"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./hello-2027-poc.module.css";
import type { ResolvedHello2027Ad } from "./use-local-hello-2027-content";

type Hello2027BannerCarouselProps = {
  ads: readonly ResolvedHello2027Ad[];
  dayPhaseClass: string;
  todayRate: number;
};

const DEFAULT_SCENE = "/images/poc/hello-2027/hello-2027-riverside.webp";
const AUTO_ADVANCE_MS = 5_000;

export function Hello2027BannerCarousel({ ads, dayPhaseClass, todayRate }: Hello2027BannerCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const slideCount = ads.length + 1;
  const visibleSlide = Math.min(currentSlide, slideCount - 1);

  const goToSlide = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const nextIndex = Math.min(Math.max(index, 0), slideCount - 1);
    track.scrollTo({
      left: track.clientWidth * nextIndex,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
    setCurrentSlide(nextIndex);
  }, [prefersReducedMotion, slideCount]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const syncVisibility = () => setIsDocumentVisible(!document.hidden);
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  useEffect(() => {
    if (
      slideCount <= 1
      || prefersReducedMotion
      || isUserPaused
      || !isDocumentVisible
      || isHovered
      || hasFocus
      || isInteracting
    ) return;
    const timeoutId = window.setTimeout(() => {
      goToSlide(visibleSlide === slideCount - 1 ? 0 : visibleSlide + 1);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [
    goToSlide,
    hasFocus,
    isDocumentVisible,
    isHovered,
    isInteracting,
    isUserPaused,
    prefersReducedMotion,
    slideCount,
    visibleSlide,
  ]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  return (
    <section
      className={styles.hero}
      aria-label="오늘의 인증률과 크루 광고"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
      }}
      onPointerDown={() => setIsInteracting(true)}
      onPointerUp={() => setIsInteracting(false)}
      onPointerCancel={() => setIsInteracting(false)}
      onLostPointerCapture={() => setIsInteracting(false)}
    >
      <div
        ref={trackRef}
        className={styles.bannerTrack}
        tabIndex={0}
        role="region"
        aria-roledescription="캐러셀"
        aria-label={`배너 ${slideCount}개${prefersReducedMotion ? "" : ", 5초마다 자동 전환"}`}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") goToSlide(visibleSlide - 1);
          if (event.key === "ArrowRight") goToSlide(visibleSlide + 1);
        }}
        onScroll={(event) => {
          const track = event.currentTarget;
          if (!track.clientWidth) return;
          if (scrollFrameRef.current !== null) return;
          const nextSlide = Math.round(track.scrollLeft / track.clientWidth);
          scrollFrameRef.current = window.requestAnimationFrame(() => {
            setCurrentSlide(nextSlide);
            scrollFrameRef.current = null;
          });
        }}
      >
        <article
          className={`${styles.bannerSlide} ${dayPhaseClass}`}
          role="group"
          aria-roledescription="슬라이드"
          aria-hidden={visibleSlide !== 0}
          aria-label={`1 / ${slideCount}, 오늘의 인증률 ${todayRate}%`}
        >
          <div className={`${styles.bannerCanvas} ${styles.todayBannerCanvas}`}>
            <div className={styles.worldLayer} aria-hidden="true">
              <Image src={DEFAULT_SCENE} alt="" fill preload sizes="100vw" />
            </div>
            <div className={styles.timeTint} aria-hidden="true" />
            <div className={styles.storyBanner}>
              <h2>오늘의 인증률</h2>
              <strong>{todayRate}%</strong>
            </div>
          </div>
        </article>

        {ads.map((ad, index) => (
          <article
            className={styles.bannerSlide}
            key={ad.id}
            role="group"
            aria-roledescription="슬라이드"
            aria-hidden={visibleSlide !== index + 1}
            aria-label={`${index + 2} / ${slideCount}, ${ad.ownerName}님의 ${ad.title} 광고`}
          >
            <div className={styles.bannerCanvas}>
              <div className={styles.worldLayer}>
                {Math.abs(index + 1 - visibleSlide) <= 1 ? (
                  <Image
                    src={ad.imageSrc || DEFAULT_SCENE}
                    alt={ad.alt}
                    fill
                    unoptimized={ad.isUploaded}
                    sizes="100vw"
                    className={ad.mobileFocus === "left"
                      ? styles.mobileFocusLeft
                      : ad.mobileFocus === "right"
                        ? styles.mobileFocusRight
                        : styles.mobileFocusCenter}
                  />
                ) : null}
              </div>
              <div className={styles.adImageScrim} aria-hidden="true" />
              <div className={styles.adCopyFloating}>
                <span>{ad.ownerName}님의 광고</span>
                <strong>{ad.title}</strong>
                <p>{ad.description}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <button
        className={`${styles.carouselArrow} ${styles.carouselArrowPrevious}`}
        type="button"
        aria-label="이전 배너"
        disabled={visibleSlide === 0}
        onClick={() => goToSlide(visibleSlide - 1)}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        className={`${styles.carouselArrow} ${styles.carouselArrowNext}`}
        type="button"
        aria-label="다음 배너"
        disabled={visibleSlide === slideCount - 1}
        onClick={() => goToSlide(visibleSlide + 1)}
      >
        <span aria-hidden="true">›</span>
      </button>

      <div className={styles.carouselFooter}>
        <div className={styles.carouselDots} aria-label="배너 선택">
          {Array.from({ length: slideCount }, (_, index) => (
            <button
              type="button"
              key={index}
              aria-label={`${index + 1}번째 배너 보기`}
              aria-current={index === visibleSlide ? "true" : undefined}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
        <span>{visibleSlide + 1} / {slideCount}</span>
        <button
          className={styles.carouselToggle}
          type="button"
          aria-pressed={isUserPaused}
          aria-label={prefersReducedMotion
            ? "배너 자동 전환 정지됨"
            : isUserPaused ? "배너 자동 전환 재생" : "배너 자동 전환 일시정지"}
          disabled={prefersReducedMotion || slideCount <= 1}
          onClick={(event) => {
            const shouldResume = isUserPaused;
            setIsUserPaused(!isUserPaused);

            // Pointer activation leaves focus on the button, which would keep
            // the carousel paused via focus/hover. An explicit pointer resume
            // wins until the pointer leaves and enters the banner again;
            // keyboard focus still pauses it for accessibility.
            if (shouldResume && event.detail > 0) {
              setIsHovered(false);
              event.currentTarget.blur();
            }
          }}
        >
          <span
            className={isUserPaused ? styles.carouselPlayIcon : styles.carouselPauseIcon}
            aria-hidden="true"
          />
        </button>
      </div>
    </section>
  );
}
