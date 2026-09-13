"use client";

import Image from "next/image";
import { MyActivityDialog, openMyActivity } from "@/components/my-activity-dialog";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Hello2027BannerCarousel } from "./hello-2027-banner-carousel";
import { Hello2027Guestbook } from "./hello-2027-guestbook";
import { ParticipantRecordCalendar } from "./participant-record-calendar";
import type {
  Hello2027Participant,
  Hello2027Snapshot,
} from "@/lib/hello-2027-types";
import styles from "./hello-2027-poc.module.css";
import { DEFAULT_HELLO_2027_PROFILE_IMAGE_URL, resolveHello2027ProfileImageUrl } from "@/lib/hello-2027-profile-image";
import { useLocalHello2027Content } from "./use-local-hello-2027-content";
import { KakaoLoginButton } from "@/components/kakao-login-button";
import { useOptionalFourthViewer } from "@/components/fourth-viewer-provider";
import { formatFourthSeasonDday } from "@/lib/fourth-season-contract";
import { DASHBOARD_SNAPSHOT_DOM_EVENT } from "@/lib/dashboard-refresh-contract";

type Hello2027PocProps = {
  snapshot: Hello2027Snapshot;
  initialDayPhase?: DayPhase;
  currentDateIso?: string;
  memberFeatures?: boolean;
};

type DayPhase = "night" | "dawn" | "morning" | "day" | "sunset" | "evening";
type CrewSort = "name" | "completed" | "distance" | "duration";
const ENCOURAGEMENT_ROTATION_MS = 18_000;

function subscribeToClock(onStoreChange: () => void) {
  let timeoutId: number;
  const tick = () => {
    window.clearTimeout(timeoutId);
    if (document.hidden) return;
    onStoreChange();
    timeoutId = window.setTimeout(tick, 60_000 - Date.now() % 60_000 + 20);
  };
  tick();
  window.addEventListener("focus", tick);
  document.addEventListener("visibilitychange", tick);
  return () => {
    window.clearTimeout(timeoutId);
    window.removeEventListener("focus", tick);
    document.removeEventListener("visibilitychange", tick);
  };
}

function getSeoulTimeSnapshot() {
  const now = new Date();
  return `${String((now.getUTCHours() + 9) % 24).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
}

function HeaderClock() {
  // Only this small label rerenders each minute. The server and first client
  // render share the same placeholder, avoiding timezone/hydration mismatches.
  const time = useSyncExternalStore(subscribeToClock, getSeoulTimeSnapshot, () => "--:--");
  return <span className={styles.liveTime} aria-label={`서울 현재 시각 ${time}`}>{time}</span>;
}

function getDayPhase(date: Date): DayPhase {
  const seoulHour = (date.getUTCHours() + 9) % 24;
  const hour = seoulHour + date.getUTCMinutes() / 60;
  if (hour < 5 || hour >= 22) return "night";
  if (hour < 7) return "dawn";
  if (hour < 10) return "morning";
  if (hour < 17) return "day";
  if (hour < 19) return "sunset";
  return "evening";
}

function getSeoulDateIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function getClockSnapshot() {
  const now = new Date();
  return `${getDayPhase(now)}|${getSeoulDateIso(now)}`;
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(`${value}T00:00:00Z`).getUTCDay()
  ];
  return {
    label: `${year}. ${month}. ${day}. ${weekday}요일`,
    short: `${month}.${day}(${weekday})`,
  };
}

export function Hello2027Poc({
  snapshot,
  initialDayPhase = "day",
  currentDateIso,
  memberFeatures = false,
}: Hello2027PocProps) {
  const [liveSnapshot, setLiveSnapshot] = useState(snapshot);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [crewSort, setCrewSort] = useState<CrewSort>("name");
  const clockSnapshot = useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    () => `${initialDayPhase}|${currentDateIso ?? snapshot.referenceDateIso ?? "2026-09-06"}`,
  );
  const [dayPhase, seoulToday] = clockSnapshot.split("|") as [DayPhase, string];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const localContent = useLocalHello2027Content(snapshot.ads, snapshot.encouragements, memberFeatures);
  const viewerState = useOptionalFourthViewer();
  const dashboardDate = formatKoreanDate(seoulToday);
  const referenceDateIso = seoulToday;
  const referenceDateLabel = dashboardDate.label;
  const referenceDateShort = dashboardDate.short;
  const seasonDday = formatFourthSeasonDday(referenceDateIso) ?? "D-DAY";

  const selectedParticipant = useMemo(
    () => liveSnapshot.participants.find((participant) => participant.id === selectedParticipantId) ?? null,
    [liveSnapshot.participants, selectedParticipantId],
  );
  const sortedParticipants = useMemo(() => {
    const participants = [...liveSnapshot.participants];
    if (crewSort === "completed") {
      return participants.sort((left, right) => (
        right.seasonCompletionRate - left.seasonCompletionRate
        || left.fullName.localeCompare(right.fullName, "ko")
      ));
    }
    if (crewSort === "distance" || crewSort === "duration") {
      const metric = crewSort === "distance" ? "totalDistanceKm" : "totalDurationMinutes";
      return participants.sort((a, b) => b[metric] - a[metric] || a.fullName.localeCompare(b.fullName, "ko"));
    }
    return participants.sort((left, right) => left.fullName.localeCompare(right.fullName, "ko"));
  }, [crewSort, liveSnapshot.participants]);

  useEffect(() => {
    const applySnapshot = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const nextSnapshot = event.detail as Hello2027Snapshot | null;
      if (!nextSnapshot || !Array.isArray(nextSnapshot.participants) || !Array.isArray(nextSnapshot.rates)) return;
      setLiveSnapshot(nextSnapshot);
    };
    window.addEventListener(DASHBOARD_SNAPSHOT_DOM_EVENT, applySnapshot);
    return () => window.removeEventListener(DASHBOARD_SNAPSHOT_DOM_EVENT, applySnapshot);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !selectedParticipant || dialog.open) return;

    dialog.showModal();
    window.requestAnimationFrame(() => dialogTitleRef.current?.focus());
  }, [selectedParticipant]);

  useEffect(() => {
    if (!selectedParticipant) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedParticipant]);

  const openParticipant = (participantId: string, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setSelectedParticipantId(participantId);
  };

  const closeParticipant = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    setSelectedParticipantId(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };


  return (
    <div className={styles.page}>
      <header className={styles.siteHeader}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href="#top" aria-label="TWTT 4th Hello 2027 처음으로 이동">
            <Image
              className={styles.brandLogo}
              src="/brand/twtt-logo.png"
              alt=""
              width={640}
              height={310}
              sizes="(max-width: 760px) 58px, 78px"
            />
          </a>

          <div className={styles.headerMeta} aria-label="오늘 날짜와 시각, 계정">
            <time className={styles.headerDateTime} dateTime={referenceDateIso} title={referenceDateLabel}>
              <span>TODAY</span>
              <span>{referenceDateShort}</span>
              <HeaderClock />
            </time>
            {memberFeatures ? (
              <div className={styles.headerAccount} aria-label="개인 계정">
                {viewerState?.loading ? (
                  <span className={styles.headerAuthLoading} aria-label="로그인 상태 확인 중" />
                ) : viewerState?.viewer?.authenticated ? (
                  <>
                    <button type="button" className={styles.headerAccountLink} aria-haspopup="dialog"
                      onPointerEnter={() => void import("@/components/my-activity-content")}
                      onFocus={() => void import("@/components/my-activity-content")}
                      onClick={() => openMyActivity()}>
                      내 정보
                    </button>
                    <button
                      className={styles.headerLogoutButton}
                      type="button"
                      disabled={viewerState.actionPending}
                      onClick={() => void viewerState.logout()}
                    >
                      {viewerState.actionPending ? "처리 중" : "로그아웃"}
                    </button>
                  </>
                ) : (
                  <KakaoLoginButton nextPath="/4th/dashboard" label="로그인" variant="compact" />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main id="top" className={styles.main}>
        <h1 className={styles.visuallyHidden}>{liveSnapshot.seasonName} {liveSnapshot.versionName}</h1>

        <>
          {localContent.encouragements.length > 0 ? (
            <MotivationBanner
              encouragements={localContent.encouragements}
              initialIndex={Math.max(liveSnapshot.dayNumber - 1, 0)}
            />
          ) : null}

          <Hello2027BannerCarousel
            crewGoalDistanceKm={liveSnapshot.crewGoalDistanceKm ?? 0}
            ads={localContent.ads}
            dayPhase={dayPhase}
            completedToday={liveSnapshot.completedToday}
            participantCount={liveSnapshot.participantCount}
            seasonDday={memberFeatures ? seasonDday : undefined}
          />

          <section className={styles.summarySection} aria-label="시즌 인증 요약">
            <div className={styles.summaryGrid}>
              <article className={styles.summaryCard}>
                <span>{liveSnapshot.totalDays}일 중</span>
                <strong>{liveSnapshot.dayNumber}일</strong>
              </article>
              <article className={styles.summaryCard}>
                <span>총 누적거리</span>
                <strong className={styles.summaryTotal}>{(liveSnapshot.officialTotals?.distanceKm ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}km</strong>
              </article>
              <article className={styles.summaryCard}>
                <span>총 누적 시간</span>
                <strong className={styles.summaryTotal}>{formatTotalDuration(liveSnapshot.officialTotals?.durationMinutes ?? 0)}</strong>
              </article>
            </div>
          </section>

          {sortedParticipants.length > 0 ? (
            <section id="crew" className={styles.crewSection} aria-labelledby="crew-title">
              <div className={styles.crewHeading}>
                <div>
                  <h2 id="crew-title">멤버</h2>
                  <span className={styles.crewCount}>{liveSnapshot.participantCount}명</span>
                </div>
                <div className={styles.crewSort} role="group" aria-label="멤버 정렬 방식">
                  <button
                    type="button"
                    aria-pressed={crewSort === "name"}
                    onClick={() => setCrewSort("name")}
                  >
                    가나다순
                  </button>
                  <button
                    type="button"
                    aria-pressed={crewSort === "completed"}
                    onClick={() => setCrewSort("completed")}
                  >
                    인증률
                  </button>
                  <button type="button" aria-pressed={crewSort === "distance"} onClick={() => setCrewSort("distance")}>거리순</button>
                  <button type="button" aria-pressed={crewSort === "duration"} onClick={() => setCrewSort("duration")}>시간순</button>
                </div>
              </div>

              <ul className={styles.participantGrid}>
                {sortedParticipants.map((participant) => (
                  <li key={participant.id}>
                    <button
                      className={`${styles.participantCard} ${participant.completed ? styles.completedCard : styles.waitingCard}`}
                      type="button"
                      onClick={(event) => openParticipant(participant.id, event.currentTarget)}
                      aria-label={`${participant.fullName}님, 오늘까지 인증률 ${participant.seasonCompletionRate}%, ${participant.completed ? "오늘 인증 완료" : "오늘 기록 없음"}. 상세 보기`}
                    >
                      {participant.completed ? (
                        <span className={styles.completionBadge} aria-hidden="true">✓</span>
                      ) : null}
                      <span className={styles.participantIdentity}>
                        <span className={styles.characterWrap} aria-hidden="true">
                          <ParticipantAvatar imageUrl={participant.profileImageUrl} />
                        </span>
                        <span className={styles.participantNameRow}>
                          <strong>{participant.fullName}<small>님</small></strong>
                        </span>
                      </span>
                      <span className={styles.participantRate}>
                        <small>오늘까지 인증률</small>
                        <strong>{participant.seasonCompletionRate}%</strong>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : <FourthSeasonMemberEmptyState />}

          <Hello2027Guestbook
            initialThreads={snapshot.guestbook}
            externalViewer={memberFeatures ? viewerState?.viewer ?? null : undefined}
            externalViewerManaged={memberFeatures}
            externalViewerLoading={memberFeatures ? viewerState?.loading ?? true : undefined}
          />
        </>
      </main>

      {/* Keep the sheet outside the header's nowrap and mobile time rules. */}
      {memberFeatures && viewerState?.viewer?.authenticated ? (
                    <MyActivityDialog
                      key={viewerState.viewer.participant_id ?? "unlinked"}
                      showTrigger={false}
                      name={viewerState.viewer.display_name || "멤버"}
                      imageUrl={liveSnapshot.participants.find(p => p.id === viewerState.viewer?.participant_id)?.profileImageUrl}
                      onChanged={patch => {
                        const id = viewerState.viewer?.participant_id;
                        setLiveSnapshot(current => ({ ...current, participants: current.participants.map(p => p.id === id ? { ...p, ...(patch.displayName === undefined ? {} : { fullName: patch.displayName }), ...(patch.profileImageUrl === undefined ? {} : { profileImageUrl: patch.profileImageUrl }) } : p) }));
                      }}
                    />
      ) : null}

      <ParticipantDialog
        dialogRef={dialogRef}
        titleRef={dialogTitleRef}
        participant={selectedParticipant}
        today={referenceDateIso}
        onClose={closeParticipant}
      />
    </div>
  );
}

function FourthSeasonMemberEmptyState() {
  return (
    <section id="crew" className={styles.crewSection} aria-labelledby="crew-title">
      <div className={styles.crewHeading}>
        <div>
          <h2 id="crew-title">멤버</h2>
        </div>
      </div>
      <div className={styles.memberEmptyState}>
        <p>현재 4기 멤버 확정 전이며, 9월 중순 공개됩니다.</p>
      </div>
    </section>
  );
}

type MotivationBannerProps = {
  encouragements: readonly string[];
  initialIndex: number;
};

function MotivationBanner({ encouragements, initialIndex }: MotivationBannerProps) {
  const [quoteIndex, setQuoteIndex] = useState(() => (
    encouragements.length > 0 ? initialIndex % encouragements.length : 0
  ));
  const [rotationEnabled, setRotationEnabled] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateRotation = () => setRotationEnabled(!mediaQuery.matches && !document.hidden);
    updateRotation();
    mediaQuery.addEventListener("change", updateRotation);
    document.addEventListener("visibilitychange", updateRotation);
    return () => {
      mediaQuery.removeEventListener("change", updateRotation);
      document.removeEventListener("visibilitychange", updateRotation);
    };
  }, []);

  useEffect(() => {
    if (!rotationEnabled || encouragements.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % encouragements.length);
    }, ENCOURAGEMENT_ROTATION_MS);
    return () => window.clearInterval(intervalId);
  }, [encouragements.length, rotationEnabled]);

  const visibleQuoteIndex = encouragements.length > 0 ? quoteIndex % encouragements.length : 0;
  const encouragement = encouragements[visibleQuoteIndex] ?? "";

  if (!encouragement) return null;

  return (
    <section className={styles.motivationBanner} aria-labelledby="motivation-title">
      <div className={styles.motivationHeader}>
        <span id="motivation-title">내던지는 명언 50선</span>
      </div>
      <p key={`${visibleQuoteIndex}-${encouragement}`}>{encouragement}</p>
    </section>
  );
}

type ParticipantDialogProps = {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  participant: Hello2027Participant | null;
  today: string;
  onClose: () => void;
};

function ParticipantAvatar({
  imageUrl,
  dialog = false,
}: {
  imageUrl?: string | null;
  dialog?: boolean;
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const resolvedImageUrl = resolveHello2027ProfileImageUrl(imageUrl);
  const visibleImageUrl = failedImageUrl === resolvedImageUrl
    ? DEFAULT_HELLO_2027_PROFILE_IMAGE_URL
    : resolvedImageUrl;

  return (
    <Image
      src={visibleImageUrl}
      alt=""
      fill
      unoptimized={visibleImageUrl !== DEFAULT_HELLO_2027_PROFILE_IMAGE_URL}
      sizes={dialog ? "132px" : "96px"}
      onError={() => setFailedImageUrl(resolvedImageUrl)}
    />
  );
}

function formatTotalDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  if (safeMinutes < 60) return `${safeMinutes}분`;
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return remainder ? `${hours}시간 ${remainder}분` : `${hours}시간`;
}

function formatDistanceKm(value: number | null) {
  if (value === null) return "거리 미입력";
  return <>{value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}<small>km</small></>;
}

export function ParticipantDialog({
  dialogRef,
  titleRef,
  participant,
  today,
  onClose,
}: ParticipantDialogProps) {

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${styles.memberDialog}`}
      aria-labelledby="participant-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {participant ? (
        <div className={`${styles.dialogPanel} ${styles.memberPanel}`}>
          <button className={styles.dialogClose} type="button" onClick={onClose} aria-label="상세창 닫기">
            ×
          </button>
          <div className={styles.dialogProfile}>
            <div className={styles.profileImageEditor}>
              <div className={styles.dialogCharacter} aria-hidden="true">
                <ParticipantAvatar imageUrl={participant.profileImageUrl} dialog />
              </div>
            </div>
            <div>
              <h2 id="participant-dialog-title" ref={titleRef} tabIndex={-1}>{participant.fullName}</h2>
            </div>
          </div>

          <dl className={styles.recordGrid}>
            <div>
              <dt>총 인증일</dt>
              <dd>{participant.certifiedDays}일</dd>
            </div>
            <div>
              <dt>누적 거리</dt>
              <dd>{formatDistanceKm(participant.totalDistanceKm)}</dd>
            </div>
            <div>
              <dt>누적 시간</dt>
              <dd>{formatTotalDuration(participant.totalDurationMinutes)}</dd>
            </div>
          </dl>

          <div className={styles.memberCalendar}><ParticipantRecordCalendar
            key={participant.id}
            records={participant.recordHistory}
            certifiedDays={participant.certifiedDays}
            today={today}
            showTotal={false}
            showLegend={false}
            compact
          /></div>
        </div>
      ) : null}
    </dialog>
  );
}
