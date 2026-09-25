"use client";

import { type ReactNode, useId, useMemo, useState } from "react";
import type { Hello2027ParticipantRecordEntry } from "@/lib/hello-2027-types";
import { getRecordMonthDays, shiftRecordMonth } from "@/lib/participant-record-calendar";
import styles from "./participant-record-calendar.module.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatMinutes(minutes: number | null) {
  if (minutes === null) return "미입력";
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  return hours > 0 ? `${hours}시간${rounded % 60 ? ` ${rounded % 60}분` : ""}` : `${rounded}분`;
}

export function ParticipantRecordCalendar({
  records,
  certifiedDays,
  today,
  showLegend = true,
  showTotal = true,
  compact = false,
  privateImageRecordIds,
  children,
}: {
  records: readonly Hello2027ParticipantRecordEntry[];
  certifiedDays: number;
  today: string;
  showLegend?: boolean;
  showTotal?: boolean;
  compact?: boolean;
  children?: ReactNode;
  /** Supplied only by My Activity, never by the public member profile. */
  privateImageRecordIds?: Readonly<Record<string, string>>;
}) {
  const titleId = useId();
  const recordsByDate = useMemo(() => {
    const map = new Map<string, Hello2027ParticipantRecordEntry>();
    for (const record of records) {
      const previous = map.get(record.recordDateIso);
      map.set(record.recordDateIso, previous ? {...record,
        distanceKm: previous.distanceKm === null && record.distanceKm === null ? null : (previous.distanceKm ?? 0) + (record.distanceKm ?? 0),
        durationMinutes: previous.durationMinutes === null && record.durationMinutes === null ? null : (previous.durationMinutes ?? 0) + (record.durationMinutes ?? 0),
        status: previous.status === "certified" || record.status === "certified" ? "certified" : "needs_review",
        isPersonal: previous.status !== "certified" && record.status !== "certified" && Boolean(previous.isPersonal || record.isPersonal),
      } : {...record});
    }
    return map;
  }, [records]);
  const dates = [...recordsByDate.keys()].sort();
  const latestDate = dates.at(-1) ?? today;
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  // Until the user navigates, newly identified records remain immediately visible.
  const month = chosenMonth ?? latestDate.slice(0, 7);
  const monthDates = dates.filter((date) => date.startsWith(month));
  const selectedDate = chosenDate?.startsWith(month)
    ? chosenDate
    : monthDates.at(-1) ?? (today.startsWith(month) ? today : `${month}-01`);
  const selectedRecord = recordsByDate.get(selectedDate);
  const firstMonth = (dates[0] && dates[0] < today ? dates[0] : today).slice(0, 7);
  const lastMonth = (latestDate > today ? latestDate : today).slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const monthLabel = `${year}년 ${monthNumber}월`;
  const selectedDateLabel = `${Number(selectedDate.slice(5, 7))}월 ${Number(selectedDate.slice(8))}일`;

  const moveMonth = (offset: number) => {
    setChosenMonth(shiftRecordMonth(month, offset));
    setChosenDate(null);
  };

  return (
    <section className={styles.section} data-compact={compact || undefined} aria-labelledby={titleId}>
      <div className={styles.heading}>
        <h3 id={titleId}>인증 캘린더</h3>
        {showLegend && <div className={styles.legend} aria-label="기록 상태 안내">
          <span><i className={styles.certifiedDot} />인증 완료</span>
        </div>}
      </div>
      <div className={styles.calendar}>
        <div className={styles.monthNavigation}>
          <strong aria-live="polite">{monthLabel}</strong>
          <div>
            <button type="button" onClick={() => moveMonth(-1)} disabled={month <= firstMonth} aria-label="이전 달">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
            </button>
            <button type="button" onClick={() => moveMonth(1)} disabled={month >= lastMonth} aria-label="다음 달">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
            </button>
          </div>
        </div>
        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className={styles.days} role="group" aria-label={`${monthLabel} 인증일 선택`}>
          {getRecordMonthDays(month).map((date, index) => {
            if (!date) return <span key={`empty-${index}`} aria-hidden="true" />;
            const record = recordsByDate.get(date);
            const isSelected = date === selectedDate;
            const status = record?.isPersonal ? "개인 기록" : record?.status === "certified" ? "인증 완료" : record ? "운동 기록" : "기록 없음";
            return (
              <button
                key={date}
                type="button"
                className={`${styles.day} ${record ? record.status === "certified" ? styles.certified : styles.pending : ""} ${isSelected ? styles.selected : ""}`}
                aria-label={`${monthNumber}월 ${Number(date.slice(8))}일 ${WEEKDAYS[index % 7]}요일, ${status}${record ? `, ${record.distanceKm === null ? "거리 미입력" : `${record.distanceKm}km`}, ${formatMinutes(record.durationMinutes)}` : ""}`}
                aria-pressed={isSelected}
                aria-current={date === today ? "date" : undefined}
                onClick={() => setChosenDate(date)}
              >
                <span>{Number(date.slice(8))}</span>
                {record ? <small>{record.distanceKm === null ? "기록" : `${Number(record.distanceKm.toFixed(1))}k`}</small> : <small aria-hidden="true">{date === today ? "오늘" : "\u00a0"}</small>}
              </button>
            );
          })}
        </div>
        <div className={styles.detail} aria-live="polite" aria-atomic="true">
          <div className={styles.detailHeading}>
            <time dateTime={selectedDate}>{selectedDateLabel}의 기록</time>
            {selectedRecord?.isPersonal ? <span className={styles.certifiedBadge}>개인 기록</span> : selectedRecord?.status === "certified" ? <span className={styles.certifiedBadge}>인증 완료</span> : null}
          </div>
          {selectedRecord ? (
            <dl className={styles.metrics}>
              <div><dt>달린 거리</dt><dd>{selectedRecord.distanceKm === null ? "미입력" : <>{Number(selectedRecord.distanceKm.toFixed(2))}<small> km</small></>}</dd></div>
              <div><dt>시간</dt><dd>{formatMinutes(selectedRecord.durationMinutes)}</dd></div>
            </dl>
          ) : <p className={styles.empty}>{records.length === 0 ? "첫 기록을 기다리고 있어요." : "이날은 등록된 기록이 없어요."}</p>}
          {records.filter(record => record.recordDateIso === selectedDate).length > 1 && <p className={styles.empty}>운동 {records.filter(record => record.recordDateIso === selectedDate).length}건 합산 · 인증일은 하루 1일로 계산해요.</p>}
          {privateImageRecordIds?.[selectedDate] ? (
            <a className={styles.imageLink} href={`/api/me/records/image/${encodeURIComponent(privateImageRecordIds[selectedDate])}`} target="_blank" rel="noopener noreferrer">인증샷 보기 ↗</a>
          ) : null}
        </div>
        {children}
      </div>
      {showTotal && <div className={styles.total}>
        <div><span>총 인증일</span></div>
        <strong>{certifiedDays}<span>일</span></strong>
      </div>}
    </section>
  );
}
