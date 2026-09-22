"use client";

import { projectDashboardRecords } from "@/lib/dashboard-record-visibility";
import { VisitorCrewCheer } from "@/components/visitor-crew-cheer";
import { PersonalGoalBanner } from "@/components/personal-goal-banner";
import { ActivityIcon } from "@/components/activity-icon";
import { PublicSiteHeader } from "@/components/public-site-header";
import { SeasonSchedule } from "@/components/season-schedule";
import { PublicSiteFooter } from "@/components/public-site-footer";
import { usePageScrollLock } from "@/lib/use-page-scroll-lock";
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
import { TimeMachineBadge } from "@/components/time-machine-badge";
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
const ENCOURAGEMENT_ROTATION_MS = 30_000;

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
  const [crewSort, setCrewSort] = useState<"completed" | "distance">("completed");
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
  const canViewRecords = !memberFeatures || Boolean(viewerState?.viewer?.approved_participant);
  const dashboardDate = formatKoreanDate(seoulToday);
  const referenceDateIso = seoulToday;
  const referenceDateLabel = dashboardDate.label;
  const referenceDateShort = dashboardDate.short;
  const seasonDday = formatFourthSeasonDday(referenceDateIso) ?? "D-DAY";

  const selectedParticipant = useMemo(
    () => liveSnapshot.participants.find((participant) => participant.id === selectedParticipantId) ?? null,
    [liveSnapshot.participants, selectedParticipantId, canViewRecords],
  );
  const sortedParticipants = useMemo(() => {
    const participants = [...(canViewRecords ? projectDashboardRecords(liveSnapshot, false).participants : liveSnapshot.participants)];
    return participants.sort((left, right) => (
      (crewSort === "completed" ? right.certifiedDays - left.certifiedDays : right.totalDistanceKm - left.totalDistanceKm)
      || left.fullName.localeCompare(right.fullName, "ko")
    ));
  }, [liveSnapshot, canViewRecords, crewSort]);

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
    window.requestAnimationFrame(() => dialogTitleRef.current?.focus({ preventScroll: true }));
  }, [selectedParticipant]);

  usePageScrollLock(Boolean(selectedParticipant));

  const openParticipant = (participantId: string, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setSelectedParticipantId(participantId);
  };

  const closeParticipant = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    setSelectedParticipantId(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus({ preventScroll: true }));
  };


  return (
    <div id="page-top" className={styles.page}>
      <PublicSiteHeader memberFeatures={memberFeatures} />

      <main id="top" className={styles.main}>
        {memberFeatures && viewerState?.viewer?.authenticated && viewerState.viewer.approved_participant && <PersonalGoalBanner key={viewerState.viewer.participant_id} />}
        {viewerState?.viewer?.authenticated && !viewerState.viewer.approved_participant && <p role="status" className="mb-5 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-600">운영자 승인을 기다리고 있어요. 승인 후 멤버로 참여할 수 있어요.</p>}
        <h1 className={styles.visuallyHidden}>{liveSnapshot.seasonName} {liveSnapshot.versionName}</h1>

        <>
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

          {memberFeatures && viewerState?.viewer?.approved_participant && <nav className={styles.memberShortcuts} aria-label="멤버 바로가기">
            {([{ section: "fortune", label: "오늘의 운세", icon: "fortune" }, { section: "corrective", label: "교정운동 신청", icon: "corrective" }, { section: "locker", label: "보관함", icon: "gift" }] as const).map(item => <button key={item.section} type="button" onClick={() => openMyActivity(item.section)}><span><ActivityIcon kind={item.icon} size={24}/></span>{item.label}</button>)}
          </nav>}

          {sortedParticipants.length > 0 ? (
            <section id="crew" className={styles.crewSection} aria-labelledby="crew-title">
              <div className={styles.crewHeading}>
                <div>
                  <h2 id="crew-title">멤버</h2>
                  <span className={styles.crewCount}>{liveSnapshot.participantCount}명</span>
                </div>
                <div className={styles.crewSort} role="group" aria-label="멤버 정렬 방식">
                  <button type="button" aria-pressed={crewSort === "completed"} onClick={() => setCrewSort("completed")}>인증일</button>
                  <button type="button" aria-pressed={crewSort === "distance"} onClick={() => setCrewSort("distance")}>거리순</button>
                </div>
              </div>

              {memberFeatures && viewerState?.viewer && !viewerState.loading && !viewerState.error && !viewerState.viewer.authenticated && <VisitorCrewCheer />}
              <ul className={styles.participantGrid}>
                {([...sortedParticipants].sort((a,b)=>Number(b.id===viewerState?.viewer?.participant_id)-Number(a.id===viewerState?.viewer?.participant_id))).map((participant) => (
                  <li key={participant.id}>
                    <button
                      className={`${styles.participantCard} ${participant.completed ? styles.completedCard : styles.waitingCard} ${participant.id===viewerState?.viewer?.participant_id ? styles.myCard : ""}`}
                      type="button"
                      onClick={(event) => participant.id===viewerState?.viewer?.participant_id ? openMyActivity("records") : openParticipant(participant.id, event.currentTarget)}
                      aria-label={`${participant.fullName}님, 인증 ${participant.certifiedDays}일. ${canViewRecords ? "상세" : "공개"} 기록 보기`}
                    >
                      {canViewRecords && participant.completed ? (
                        <span className={styles.completionBadge} aria-hidden="true">✓</span>
                      ) : null}
                      <span className={styles.participantIdentity}>
                        <span style={{position:"relative",display:"inline-flex"}}><span className={styles.characterWrap} aria-hidden="true"><ParticipantAvatar imageUrl={participant.profileImageUrl} /></span></span>
                        <span className={styles.participantNameRow}>
                          <strong>{participant.fullName}<small>{participant.id===viewerState?.viewer?.participant_id ? " · 나" : "님"}</small></strong>
                        </span>
                      </span>
                      <span className={styles.participantRate}>
                        <small>{crewSort === "completed" ? "총 인증일" : "누적 거리"}</small>
                        <strong className={styles.cardMetric}>{crewSort === "completed" ? `${participant.certifiedDays}일` : formatDistanceKm(participant.totalDistanceKm)}</strong>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : <FourthSeasonMemberEmptyState />}

          <SeasonSchedule today={seoulToday} authenticated={Boolean(viewerState?.viewer?.authenticated)} />

          {viewerState?.viewer?.approved_participant && <Hello2027Guestbook
            initialThreads={snapshot.guestbook}
            externalViewer={memberFeatures ? viewerState?.viewer ?? null : undefined}
            externalViewerManaged={memberFeatures}
            externalViewerLoading={memberFeatures ? viewerState?.loading ?? true : undefined}
          />}
        </>
        <PublicSiteFooter />
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
        showDetailedRecords={canViewRecords}
        dialogRef={dialogRef}
        titleRef={dialogTitleRef}
        introduction={selectedParticipant ? localContent.profileIntroductions[selectedParticipant.id] : undefined}
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
  showDetailedRecords?: boolean;
  introduction?: {title:string;body:string};
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
  showDetailedRecords = true,
  introduction,
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
              <div style={{position:"relative"}}><div className={styles.dialogCharacter} aria-hidden="true"><ParticipantAvatar imageUrl={participant.profileImageUrl} dialog /></div></div>
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


          {<div className={styles.memberCalendar}><ParticipantRecordCalendar
            key={participant.id}
            records={participant.recordHistory}
            certifiedDays={participant.certifiedDays}
            today={today}
            showTotal={false}
            showLegend={false}
            compact
          /></div>}
          <section className="mt-5 rounded-2xl bg-blue-50 p-5"><h3 className="text-base font-bold text-blue-600">{introduction?.title || "자기소개"}</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{introduction?.body || "자기소개를 준비하고 있어요."}</p></section>
        </div>
      ) : null}
    </dialog>
  );
}
