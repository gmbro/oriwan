"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Hello2027BannerCarousel } from "./hello-2027-banner-carousel";
import { Hello2027Guestbook } from "./hello-2027-guestbook";
import type {
  Hello2027Participant,
  Hello2027ProfileIntroduction,
  Hello2027Snapshot,
} from "./hello-2027-poc-data";
import styles from "./hello-2027-poc.module.css";
import { TwttRunnerPictogram } from "./twtt-runner-pictogram";
import { useLocalHello2027Content } from "./use-local-hello-2027-content";
import { FourthDashboardMemberArea } from "@/components/fourth-dashboard-member-area";
import { KakaoLoginButton } from "@/components/kakao-login-button";
import { useOptionalFourthViewer } from "@/components/fourth-viewer-provider";

type Hello2027PocProps = {
  snapshot: Hello2027Snapshot;
  initialDayPhase?: DayPhase;
  memberFeatures?: boolean;
};

type DayPhase = "night" | "dawn" | "morning" | "day" | "sunset" | "evening";
type CrewSort = "name" | "completed";
const ENCOURAGEMENT_ROTATION_MS = 8_000;

function subscribeToClock(onStoreChange: () => void) {
  const intervalId = window.setInterval(onStoreChange, 60_000);
  window.addEventListener("focus", onStoreChange);
  document.addEventListener("visibilitychange", onStoreChange);
  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener("focus", onStoreChange);
    document.removeEventListener("visibilitychange", onStoreChange);
  };
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

function getDayPhaseSnapshot() {
  return getDayPhase(new Date());
}

export function Hello2027Poc({ snapshot, initialDayPhase = "day", memberFeatures = false }: Hello2027PocProps) {
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [crewSort, setCrewSort] = useState<CrewSort>("name");
  const dayPhase = useSyncExternalStore(
    subscribeToClock,
    getDayPhaseSnapshot,
    () => initialDayPhase,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const localContent = useLocalHello2027Content(snapshot.ads, snapshot.encouragements, memberFeatures);
  const viewerState = useOptionalFourthViewer();

  const selectedParticipant = useMemo(
    () => snapshot.participants.find((participant) => participant.id === selectedParticipantId) ?? null,
    [selectedParticipantId, snapshot.participants],
  );
  const todayRate = snapshot.participantCount > 0
    ? Math.round((snapshot.completedToday / snapshot.participantCount) * 100)
    : 0;
  const sortedParticipants = useMemo(() => {
    const participants = [...snapshot.participants];
    if (crewSort === "completed") {
      return participants.sort((left, right) => (
        Number(right.completed) - Number(left.completed)
        || left.fullName.localeCompare(right.fullName, "ko")
      ));
    }
    return participants.sort((left, right) => left.fullName.localeCompare(right.fullName, "ko"));
  }, [crewSort, snapshot.participants]);
  const dayPhaseClass: Record<DayPhase, string> = {
    night: styles.phaseNight,
    dawn: styles.phaseDawn,
    morning: styles.phaseMorning,
    day: styles.phaseDay,
    sunset: styles.phaseSunset,
    evening: styles.phaseEvening,
  };

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
              preload
              sizes="(max-width: 760px) 78px, 112px"
            />
          </a>

          <div className={styles.headerMeta} aria-label="오늘과 시즌 진행 정보">
            <time dateTime={snapshot.referenceDateIso ?? "2026-10-16"}>
              <small>TODAY</small>
              <span className={styles.longDate}>{snapshot.referenceDateLabel}</span>
              <span className={styles.shortDate}>{snapshot.referenceDateShort}</span>
            </time>
            <span className={styles.metaDivider} aria-hidden="true">·</span>
            <strong>D-{snapshot.daysUntil2027}</strong>
            {memberFeatures ? (
              <div className={styles.headerAccount} aria-label="개인 계정">
                {viewerState?.loading ? (
                  <span className={styles.headerAuthLoading} aria-label="로그인 상태 확인 중" />
                ) : viewerState?.viewer?.authenticated ? (
                  <>
                    <a className={styles.headerAccountLink} href="/me">
                      {viewerState.viewer.display_name || "내 정보"}
                    </a>
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
                  <KakaoLoginButton nextPath="/4th" label="카카오 시작" variant="compact" />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main id="top" className={styles.main}>
        <h1 className={styles.visuallyHidden}>{snapshot.seasonName} {snapshot.versionName}</h1>

        <MotivationBanner
          encouragements={localContent.encouragements}
          initialIndex={Math.max(snapshot.dayNumber - 1, 0)}
        />

        <Hello2027BannerCarousel
          ads={localContent.ads}
          dayPhaseClass={dayPhaseClass[dayPhase]}
          todayRate={todayRate}
        />

        <section className={styles.summarySection} aria-label="시즌 인증 요약">
          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span>{snapshot.totalDays}일 중</span>
              <strong>{snapshot.dayNumber}일</strong>
            </article>
            {snapshot.rates.map((rate) => (
              <article className={styles.summaryCard} key={rate.key}>
                <span>{rate.label} 인증률</span>
                <strong>{rate.value}%</strong>
              </article>
            ))}
          </div>
        </section>

        {memberFeatures ? <FourthDashboardMemberArea /> : null}

        <section id="crew" className={styles.crewSection} aria-labelledby="crew-title">
          <div className={styles.crewHeading}>
            <div>
              <span className={styles.crewCount}>{snapshot.participantCount}명</span>
              <h2 id="crew-title">CREW</h2>
            </div>
            <div className={styles.crewSort} role="group" aria-label="크루 정렬 방식">
              <button
                type="button"
                aria-pressed={crewSort === "name"}
                onClick={() => setCrewSort("name")}
              >
                이름순
              </button>
              <button
                type="button"
                aria-pressed={crewSort === "completed"}
                onClick={() => setCrewSort("completed")}
              >
                인증완료순
              </button>
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
                  <span className={styles.participantIdentity}>
                    <span className={styles.characterWrap} aria-hidden="true">
                      {localContent.avatarUrls[participant.id] ? (
                        <Image
                          src={localContent.avatarUrls[participant.id]}
                          alt=""
                          fill
                          unoptimized
                          sizes="96px"
                        />
                      ) : (
                        <TwttRunnerPictogram
                          variant={participant.pictogramIndex}
                          name={participant.fullName}
                          completed={participant.completed}
                          pose="stand"
                          portrait
                        />
                      )}
                    </span>
                    <span className={styles.participantNameRow}>
                      <strong>{participant.fullName}<small>님</small></strong>
                    </span>
                  </span>
                  <span className={styles.participantRate}>
                    {participant.completed ? <span className={styles.completionBadge}>인증 완료</span> : null}
                    <small>오늘까지 인증률</small>
                    <strong>{participant.seasonCompletionRate}%</strong>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <Hello2027Guestbook
          initialThreads={snapshot.guestbook}
          previewOnly={memberFeatures}
          externalViewer={memberFeatures ? viewerState?.viewer ?? null : undefined}
          externalViewerManaged={memberFeatures}
          externalViewerLoading={memberFeatures ? viewerState?.loading ?? true : undefined}
        />
      </main>

      <ParticipantDialog
        dialogRef={dialogRef}
        titleRef={dialogTitleRef}
        participant={selectedParticipant}
        avatarUrl={selectedParticipant ? localContent.avatarUrls[selectedParticipant.id] : undefined}
        introduction={selectedParticipant
          ? localContent.profileIntroductions[selectedParticipant.id]
            ?? localContent.profileIntroductions[`name:${selectedParticipant.fullName.replace(/\s+/g, "")}`]
            ?? {
              title: selectedParticipant.product.name,
              body: selectedParticipant.product.description,
            }
          : undefined}
        referenceDateLabel={snapshot.referenceDateLabel}
        onClose={closeParticipant}
      />
    </div>
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
  const [isUserPaused, setIsUserPaused] = useState(false);

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
    if (!rotationEnabled || isUserPaused || encouragements.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % encouragements.length);
    }, ENCOURAGEMENT_ROTATION_MS);
    return () => window.clearInterval(intervalId);
  }, [encouragements.length, isUserPaused, rotationEnabled]);

  const visibleQuoteIndex = encouragements.length > 0 ? quoteIndex % encouragements.length : 0;
  const encouragement = encouragements[visibleQuoteIndex] ?? "오늘도 안전하게, 편안하게, 그리고 함께 돌아와요.";

  return (
    <section className={styles.motivationBanner} aria-labelledby="motivation-title">
      <div className={styles.motivationHeader}>
        <span id="motivation-title">오늘의 응원글</span>
        <div className={styles.motivationControls}>
          <button
            type="button"
            aria-pressed={isUserPaused}
            disabled={!rotationEnabled || encouragements.length <= 1}
            onClick={() => setIsUserPaused((current) => !current)}
          >
            {!rotationEnabled ? "정지됨" : isUserPaused ? "재생" : "일시정지"}
          </button>
          <button
            type="button"
            disabled={encouragements.length <= 1}
            onClick={() => setQuoteIndex((current) => (current + 1) % encouragements.length)}
          >
            다음 글
          </button>
        </div>
      </div>
      <p key={`${visibleQuoteIndex}-${encouragement}`}>{encouragement}</p>
    </section>
  );
}

type ParticipantDialogProps = {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  participant: Hello2027Participant | null;
  avatarUrl?: string;
  introduction?: Hello2027ProfileIntroduction;
  referenceDateLabel: string;
  onClose: () => void;
};

function ParticipantDialog({
  dialogRef,
  titleRef,
  participant,
  avatarUrl,
  introduction,
  referenceDateLabel,
  onClose,
}: ParticipantDialogProps) {
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="participant-dialog-title"
      aria-describedby="participant-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {participant ? (
        <div className={styles.dialogPanel}>
          <button className={styles.dialogClose} type="button" onClick={onClose} aria-label="상세창 닫기">
            ×
          </button>
          <div className={styles.dialogProfile}>
            <div className={styles.dialogCharacter} aria-hidden="true">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill unoptimized sizes="132px" />
              ) : (
                <TwttRunnerPictogram
                  variant={participant.pictogramIndex}
                  name={participant.fullName}
                  completed={participant.completed}
                  pose="stand"
                  size="dialog"
                  portrait
                />
              )}
            </div>
            <div>
              <p className={styles.dialogKicker}>{participant.completed ? "오늘 아침 인증 완료" : "오늘의 기록"}</p>
              <h2 id="participant-dialog-title" ref={titleRef} tabIndex={-1}>{participant.fullName}</h2>
              <p id="participant-dialog-description" className={styles.dialogDate}>{referenceDateLabel}</p>
            </div>
          </div>

          {participant.completed ? (
            <dl className={styles.recordGrid}>
              <div>
                <dt>거리</dt>
                <dd>{participant.distanceKm?.toFixed(2)}km</dd>
              </div>
              <div>
                <dt>운동시간</dt>
                <dd>{participant.durationMinutes}분</dd>
              </div>
              <div>
                <dt>오늘까지 인증률</dt>
                <dd>{participant.seasonCompletionRate}%</dd>
              </div>
            </dl>
          ) : (
            <div className={styles.emptyRecord}>
              <strong>오늘은 아직 기록이 없어요.</strong>
              <p>빈칸도 같은 풍경 안에 편안하게 머뭅니다.</p>
            </div>
          )}

          <section className={styles.introductionCard} aria-labelledby="participant-introduction-title">
            <span>크루 소개 · {participant.fullName}</span>
            <strong id="participant-introduction-title">{introduction?.title ?? "자기소개를 준비 중이에요"}</strong>
            <p>{introduction?.body ?? "곧 이 크루의 이야기를 만나볼 수 있어요."}</p>
          </section>
        </div>
      ) : null}
    </dialog>
  );
}
