"use client";
import type { PersonalRecordsPayload } from "@/lib/personal-records";
import { ParticipantRecordCalendar } from "@/app/poc/hello-2027/participant-record-calendar";
import type { Hello2027ParticipantRecordEntry } from "@/lib/hello-2027-types";
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
      status: r.status as "certified" | "needs_review",
    }));
  return <>
    <p className={styles.muted}>9월 23일 이후 승인된 기록 기준</p>
    <dl className={styles.stats}>
      <div><dt>총 인증일</dt><dd>{official.certifiedDays}일</dd></div>
      <div><dt>누적 거리</dt><dd>{official.totalDistanceKm.toFixed(1)}km</dd></div>
      <div><dt>누적 시간</dt><dd>{Math.round(official.totalDurationSeconds / 60)}분</dd></div>
    </dl>
    <ParticipantRecordCalendar records={history} certifiedDays={official.certifiedDays} today={data.season.today} showLegend={false} showTotal={false}
      privateImageRecordIds={Object.fromEntries(data.records.filter(record => record.hasPrivateImage).map(record => [record.date, record.id]))} />
  </>;
}
