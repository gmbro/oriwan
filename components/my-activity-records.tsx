"use client";
import type { PersonalRecordsPayload } from "@/lib/personal-records";
import { ParticipantRecordCalendar } from "@/app/poc/hello-2027/participant-record-calendar";
import type { Hello2027ParticipantRecordEntry } from "@/lib/hello-2027-types";
import MyActivityRecordChart from "./my-activity-record-chart";
import { fourthMemberTotals } from "@/lib/fourth-season-contract";
import styles from "./my-activity.module.css";

export default function MyActivityRecords({ data }: { data: PersonalRecordsPayload }) {
  const official = data.summary.official;
  // OCR results remain visible before approval; only the official summary excludes them.
  const history: Hello2027ParticipantRecordEntry[] = data.records
    .filter(r => r.status === "certified" || r.status === "needs_review")
    .map(r => ({
      recordDateIso: r.date,
      monthDay: `${Number(r.date.slice(5, 7))}월 ${Number(r.date.slice(8))}일`,
      weekday: "",
      distanceKm: r.distanceKm,
      durationMinutes: r.durationSeconds === null ? null : r.durationSeconds / 60,
      isPersonal: r.isPersonal,
      status: r.status as "certified" | "needs_review",
    }));
  const totals = fourthMemberTotals(history, data.season.today);
  return <>
    <dl className={styles.stats}>
      <div><dt>총 인증일</dt><dd>{official.certifiedDays}일</dd></div>
      <div><dt>누적 거리</dt><dd>{totals.totalDistanceKm.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}km</dd></div>
      <div><dt>누적 시간</dt><dd>{formatDuration(totals.totalDurationMinutes)}</dd></div>
    </dl>
    <p className={styles.muted}>인증 거리 {totals.certifiedDistanceKm.toFixed(2)} km · 개인 거리 {totals.personalDistanceKm.toFixed(2)} km<br/>개인 기록은 9월 1일부터 합산해요.</p>
    <ParticipantRecordCalendar records={history} certifiedDays={official.certifiedDays} today={data.season.today} showLegend={false} showTotal={false} compact>
      <MyActivityRecordChart records={data.records} today={data.season.today} />
    </ParticipantRecordCalendar>
  </>;
}

function formatDuration(value: number) {
 const minutes = Math.max(0, Math.round(value));
 return minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}`;
}
