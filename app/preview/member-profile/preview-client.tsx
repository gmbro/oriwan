"use client";

import { useRef, useState } from "react";
import { ParticipantDialog } from "@/app/poc/hello-2027/hello-2027-poc";
import styles from "@/app/poc/hello-2027/hello-2027-poc.module.css";
import type { Hello2027Participant, Hello2027ParticipantRecordEntry } from "@/lib/hello-2027-types";

const records: Hello2027ParticipantRecordEntry[] = [
  ["2026-10-08", 5.24, 32, "needs_review"],
  ["2026-10-06", 7.12, 45, "certified"],
  ["2026-10-04", 3.5, 24, "certified"],
  ["2026-10-02", 5, 31, "certified"],
  ["2026-10-01", 4.82, 29, "certified"],
  ["2026-09-29", 8.1, 52, "certified"],
  ["2026-09-27", 5.65, 36, "certified"],
  ["2026-09-25", 4.2, 27, "certified"],
  ["2026-09-23", 3, 20, "certified"],
].map(([date, distance, minutes, status]) => ({
  recordDateIso: String(date),
  monthDay: `${Number(String(date).slice(5, 7))}월 ${Number(String(date).slice(8))}일`,
  weekday: ["일", "월", "화", "수", "목", "금", "토"][new Date(`${date}T00:00:00Z`).getUTCDay()],
  distanceKm: Number(distance),
  durationMinutes: Number(minutes),
  status: status as Hello2027ParticipantRecordEntry["status"],
}));

const member: Hello2027Participant = {
  id: "local-preview-only",
  fullName: "러너",
  pictogramIndex: 0,
  profileImageUrl: null,
  completed: false,
  seasonCompletionRate: 50,
  distanceKm: 5.24,
  durationMinutes: 32,
  certifiedDays: 8,
  recordHistory: records,
  totalDistanceKm: records.reduce((sum, record) => sum + (record.distanceKm ?? 0), 0),
  totalDurationMinutes: records.reduce((sum, record) => sum + (record.durationMinutes ?? 0), 0),
  product: { name: "자기소개", description: "" },
};

export function MemberProfilePreview() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [empty, setEmpty] = useState(false);
  const [sixWeeks, setSixWeeks] = useState(false);
  const participant = empty ? {
    ...member, id: "local-preview-empty", certifiedDays: 0, recordHistory: [], totalDistanceKm: 0, totalDurationMinutes: 0,
  } : member;

  const open = () => {
    dialogRef.current?.showModal();
    titleRef.current?.focus();
  };

  return (
    <main className={styles.page} style={{ minHeight: "100dvh", display: "grid", placeContent: "center", gap: 18, padding: 24 }}>
      <p style={{ color: "#3182f6", fontSize: 13, fontWeight: 650 }}>TWTT · 로컬 미리보기</p>
      <h1 style={{ fontSize: 28, fontWeight: 750 }}>하루하루 쌓이는 나의 기록</h1>
      <p style={{ color: "#8b95a1", maxWidth: 400, fontSize: 14, lineHeight: 1.8 }}>
        인증 캘린더 · 총 인증일 · 누적 거리와 시간<br />
        아래 화면은 예시 데이터이며 실제 회원 기록은 변경하지 않습니다.
      </p>
      <label style={{ color: "#6b7684", fontSize: 13 }}>
        <input type="checkbox" checked={empty} onChange={(event) => setEmpty(event.target.checked)} /> 기록 없는 상태 보기
      </label>
      <label style={{ color: "#6b7684", fontSize: 13 }}>
        <input type="checkbox" checked={sixWeeks} onChange={(event) => setSixWeeks(event.target.checked)} /> 6주 달력 보기
      </label>
      <button type="button" onClick={open} style={{ padding: "16px 24px", borderRadius: 16, border: 0, background: "#3182f6", color: "white", fontWeight: 650, cursor: "pointer" }}>
        개인창 미리보기
      </button>
      <ParticipantDialog
        dialogRef={dialogRef}
        titleRef={titleRef}
        participant={sixWeeks ? { ...participant, recordHistory: empty ? [] : [{ ...records[0], recordDateIso: "2026-08-31", monthDay: "8월 31일", weekday: "월" }] } : participant}
        today={sixWeeks ? "2026-08-31" : "2026-10-08"}
        onClose={() => dialogRef.current?.close()}
      />
    </main>
  );
}
