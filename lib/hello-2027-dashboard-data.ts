import "server-only";

import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import { PUBLIC_FOURTH_PARTICIPANT_ORDER_FILTER } from "@/lib/fourth-participant-visibility";
import {
  FOURTH_PERSONAL_RECORD_START_DATE,
  FOURTH_SEASON_DAYS,
  FOURTH_SEASON_END_DATE,
  FOURTH_SEASON_KEY,
  FOURTH_SEASON_START_DATE,
} from "@/lib/fourth-season-contract";
import { loadHello2027ProfileImageUrls } from "@/lib/hello-2027-profile-image-storage";
import {
  groupHello2027ParticipantRecords,
  roundHello2027DurationMinutes,
  sumHello2027OfficialMetrics,
  type Hello2027MetricRecord,
} from "@/lib/hello-2027-record-metrics";
import type { Hello2027Participant, Hello2027Snapshot } from "@/lib/hello-2027-types";
import { isRecoveryCertificationRecord, toKstIsoDate } from "@/lib/run-records";
import { logServerFailure } from "@/lib/server-error-log";

const MAX_LIVE_PARTICIPANTS = 100;
const RECORD_PAGE_SIZE = 1_000;
const SNAPSHOT_REVALIDATE_SECONDS = 60;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;

type ParticipantRow = {
  id: string;
  name: string;
  display_order: number | null;
  created_at: string | null;
};

type RecordRow = Hello2027MetricRecord & { notes?: string | null; source_app?: string | null; raw_extracted_text?: string | null };

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string" || CONTROL_CHARACTER_PATTERN.test(value)) return null;
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function cleanFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function pictogramIndexForParticipant(participantId: string) {
  let hash = 0;
  for (const character of participantId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 20;
}

function isoDateToUtcMs(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

function addUtcDays(value: string, days: number) {
  return new Date(isoDateToUtcMs(value) + days * 86_400_000).toISOString().slice(0, 10);
}

function inclusiveDayCount(from: string, to: string) {
  if (from > to) return 0;
  return Math.floor((isoDateToUtcMs(to) - isoDateToUtcMs(from)) / 86_400_000) + 1;
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(`${value}T00:00:00Z`).getUTCDay()
  ];
  return {
    label: `${year}. ${month}. ${day}. ${weekday}요일`,
    short: `${month}.${day} ${weekday}`,
  };
}

function formatRecordMonthDay(value: string) {
  const [, month, day] = value.split("-").map(Number);
  return `${month}월 ${day}일`;
}

function formatRecordWeekday(value: string) {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return weekdays[new Date(`${value}T00:00:00Z`).getUTCDay()] ?? "";
}

function getDayNumber(today: string) {
  if (today < FOURTH_SEASON_START_DATE) return 0;
  if (today > FOURTH_SEASON_END_DATE) return FOURTH_SEASON_DAYS;
  return Math.min(
    FOURTH_SEASON_DAYS,
    inclusiveDayCount(FOURTH_SEASON_START_DATE, today),
  );
}

function getDaysUntil2027(today: string) {
  return Math.max(
    0,
    Math.floor((isoDateToUtcMs("2027-01-01") - isoDateToUtcMs(today)) / 86_400_000),
  );
}

export function makeEmptyHello2027DashboardSnapshot(today: string): Hello2027Snapshot {
  const formattedDate = formatKoreanDate(today);
  return {
    seasonName: "TWTT 4th",
    versionName: "Hello 2027",
    referenceDateIso: today,
    referenceDateLabel: formattedDate.label,
    referenceDateShort: formattedDate.short,
    dayNumber: getDayNumber(today),
    totalDays: FOURTH_SEASON_DAYS,
    daysUntil2027: getDaysUntil2027(today),
    completedToday: 0,
    participantCount: 0,
    officialTotals: { distanceKm: 0, durationMinutes: 0 },
    rates: [
      { key: "weekly", label: "이번 주", value: 0 },
      { key: "monthly", label: "이번 달", value: 0 },
    ],
    ads: [],
    encouragements: [],
    guestbook: [],
    participants: [],
  };
}

function getPeriodStarts(referenceDate: string) {
  const reference = new Date(`${referenceDate}T00:00:00Z`);
  const daysSinceMonday = (reference.getUTCDay() + 6) % 7;
  const monday = addUtcDays(referenceDate, -daysSinceMonday);
  const monthStart = `${referenceDate.slice(0, 7)}-01`;
  return {
    week: monday < FOURTH_SEASON_START_DATE ? FOURTH_SEASON_START_DATE : monday,
    month: monthStart < FOURTH_SEASON_START_DATE ? FOURTH_SEASON_START_DATE : monthStart,
  };
}

async function fetchFourthRecords({
  service,
  adminUserId,
  throughDate,
}: {
  service: SupabaseClient;
  adminUserId: string;
  throughDate: string;
}) {
  if (throughDate < FOURTH_PERSONAL_RECORD_START_DATE) {
    return { rows: [] as RecordRow[], error: null };
  }

  const rows: RecordRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await service
      .from("daily_run_records")
      .select("participant_id, record_date, distance_km, duration_seconds, status, created_at, notes, source_app, raw_extracted_text, submission_key")
      .eq("user_id", adminUserId)
      .eq("season_key", FOURTH_SEASON_KEY)
      .in("status", ["certified", "needs_review"])
      .gte("record_date", FOURTH_PERSONAL_RECORD_START_DATE)
      .lte("record_date", throughDate)
      .order("record_date", { ascending: true })
      .order("created_at", { ascending: false })
      .range(offset, offset + RECORD_PAGE_SIZE - 1);

    if (error) return { rows, error };
    const page = (data || []) as RecordRow[];
    rows.push(...page);
    if (page.length < RECORD_PAGE_SIZE) break;
    offset += RECORD_PAGE_SIZE;
  }

  return { rows, error: null };
}

function buildLiveSnapshot({
  participants,
  records,
  profileImageUrls,
  timeMachineIds = new Set<string>(),
  today,
}: {
  participants: ParticipantRow[];
  records: RecordRow[];
  profileImageUrls: Readonly<Record<string, string>>;
  timeMachineIds?: ReadonlySet<string>;
  today: string;
}): Hello2027Snapshot {
  const participantIds = new Set(participants.map((participant) => participant.id));
  const visibleThroughDate = today > FOURTH_SEASON_END_DATE ? FOURTH_SEASON_END_DATE : today;
  const {
    officialCertifiedByParticipant: recordsByParticipant,
    visibleMetricsByParticipant,
    visibleHistoryByParticipant,
  } = groupHello2027ParticipantRecords({
    records,
    participantIds,
    personalStartDate: FOURTH_PERSONAL_RECORD_START_DATE,
    officialStartDate: FOURTH_SEASON_START_DATE,
    seasonEndDate: FOURTH_SEASON_END_DATE,
    throughDate: visibleThroughDate,
  });

  const dayNumber = getDayNumber(today);
  const realParticipants: Hello2027Participant[] = participants.map((participant) => {
    const participantRecords = recordsByParticipant.get(participant.id) || [];
    const certifiedDayCount = new Set(participantRecords.map(record => record.record_date)).size;
    const visibleMetricRecords = visibleMetricsByParticipant.get(participant.id) || [];
    const visibleHistoryRecords = visibleHistoryByParticipant.get(participant.id) || [];
    const recordHistory = visibleHistoryRecords
      .map((record) => ({
        recordDateIso: record.record_date || "",
        monthDay: record.record_date ? formatRecordMonthDay(record.record_date) : "",
        weekday: record.record_date ? formatRecordWeekday(record.record_date) : "",
        distanceKm: cleanFiniteNumber(record.distance_km),
        durationMinutes: roundHello2027DurationMinutes(record.duration_seconds),
        status: record.status,
        isPersonal: record.source_app === "member-personal" && record.status === "needs_review",
      }))
      .filter((record) => record.recordDateIso && record.monthDay)
      .sort((left, right) => right.recordDateIso.localeCompare(left.recordDateIso));
    const todayOfficialRecord = today >= FOURTH_SEASON_START_DATE && today <= FOURTH_SEASON_END_DATE
      ? participantRecords.find((record) => record.record_date === today)
      : undefined;
    const todayMetricRecord = today >= FOURTH_PERSONAL_RECORD_START_DATE && today <= FOURTH_SEASON_END_DATE
      ? visibleMetricRecords.find((record) => record.record_date === today)
      : undefined;

    return {
      id: participant.id,
      fullName: participant.name,
      timeMachineActive: today < "2027-01-01" && timeMachineIds.has(participant.id),
      pictogramIndex: pictogramIndexForParticipant(participant.id),
      profileImageUrl: profileImageUrls[participant.id] || null,
      completed: Boolean(todayOfficialRecord),
      seasonCompletionRate: dayNumber > 0
        ? Math.round((certifiedDayCount / dayNumber) * 100)
        : 0,
      distanceKm: cleanFiniteNumber(todayMetricRecord?.distance_km),
      durationMinutes: roundHello2027DurationMinutes(todayMetricRecord?.duration_seconds),
      certifiedDays: certifiedDayCount,
      recordHistory,
      // Personal-dialog distance and time are useful immediately after OCR,
      // including pre-season and review-pending rows. Certification counts and
      // rates above intentionally continue to use approved official records only.
      totalDistanceKm: visibleMetricRecords.reduce(
        (total, record) => total + (cleanFiniteNumber(record.distance_km) || 0),
        0,
      ),
      totalDurationMinutes: Math.round(visibleMetricRecords.reduce(
        (total, record) => total + (cleanFiniteNumber(record.duration_seconds) || 0),
        0,
      ) / 60),
      product: {
        name: "자기소개",
        description: "",
      },
    };
  });

  const countRate = (from: string, to: string) => {
    const periodDays = inclusiveDayCount(from, to);
    if (periodDays === 0) return 0;
    const completedSlots = Array.from(recordsByParticipant.values()).flat().filter((record) => (
      Boolean(record.record_date && record.record_date >= from && record.record_date <= to)
    )).length;
    return Math.round((completedSlots / (participants.length * periodDays)) * 100);
  };

  const hasStarted = today >= FOURTH_SEASON_START_DATE;
  const periodStarts = hasStarted ? getPeriodStarts(visibleThroughDate) : null;
  const completedToday = realParticipants.filter((participant) => participant.completed).length;
  const formattedDate = formatKoreanDate(today);

  return {
    ...makeEmptyHello2027DashboardSnapshot(today),
    referenceDateIso: today,
    referenceDateLabel: formattedDate.label,
    referenceDateShort: formattedDate.short,
    dayNumber,
    totalDays: FOURTH_SEASON_DAYS,
    daysUntil2027: getDaysUntil2027(today),
    completedToday,
    participantCount: realParticipants.length,
    officialTotals: sumHello2027OfficialMetrics(recordsByParticipant),
    crewGoalDistanceKm: Array.from(recordsByParticipant.values()).flat().reduce((total, record) =>
      total + (isRecoveryCertificationRecord(record as RecordRow) ? 0 : cleanFiniteNumber(record.distance_km) ?? 0), 0),
    rates: [
      {
        key: "weekly",
        label: "이번 주",
        value: periodStarts ? countRate(periodStarts.week, visibleThroughDate) : 0,
      },
      {
        key: "monthly",
        label: "이번 달",
        value: periodStarts ? countRate(periodStarts.month, visibleThroughDate) : 0,
      },
    ],
    participants: realParticipants,
  };
}

async function loadHello2027DashboardSnapshot(): Promise<Hello2027Snapshot> {
  const today = toKstIsoDate();
  const emptySnapshot = makeEmptyHello2027DashboardSnapshot(today);
  try {
    const service = getServiceClient();
    if (!service) return emptySnapshot;

    const adminUserId = await findAdminUserId(service);
    if (!adminUserId) return emptySnapshot;

    const throughDate = today > FOURTH_SEASON_END_DATE ? FOURTH_SEASON_END_DATE : today;
    const participantsRequest = service
      .from("participants")
      .select("id, name, display_order, created_at")
      .eq("user_id", adminUserId)
      .eq("season_key", FOURTH_SEASON_KEY)
      .eq("active", true)
      .or(PUBLIC_FOURTH_PARTICIPANT_ORDER_FILTER)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(MAX_LIVE_PARTICIPANTS);
    const recordsRequest = fetchFourthRecords({
      service,
      adminUserId,
      throughDate,
    });
    const profileImageUrlsRequest = loadHello2027ProfileImageUrls(service);

    const [participantsResult, recordsResult, profileImageUrls, timeMachineResult] = await Promise.all([
      participantsRequest,
      recordsRequest,
      profileImageUrlsRequest,
      service.from("time_machine_goals").select("participant_id").eq("user_id", adminUserId).eq("season_key", FOURTH_SEASON_KEY),
    ]);
    const { data, error } = participantsResult;

    if (error) return emptySnapshot;

    const participants = ((data || []) as ParticipantRow[]).flatMap((participant) => {
      const id = cleanText(participant.id, 100);
      const name = cleanText(participant.name, 40);
      return id && name ? [{ ...participant, id, name }] : [];
    });
    if (participants.length === 0) return emptySnapshot;
    if (recordsResult.error) return emptySnapshot;

    return buildLiveSnapshot({
      participants,
      records: recordsResult.rows,
      profileImageUrls,
      timeMachineIds: new Set<string>((timeMachineResult.data || []).map(row => row.participant_id)),
      today,
    });
  } catch (error) {
    logServerFailure("Hello 2027 live snapshot", error);
    return emptySnapshot;
  }
}

/** Bypasses the shared projection cache after a member-list mutation. */
export function getFreshHello2027DashboardSnapshot() {
  return loadHello2027DashboardSnapshot();
}

export const getHello2027DashboardSnapshot = unstable_cache(
  loadHello2027DashboardSnapshot,
  ["hello-2027-dashboard", FOURTH_SEASON_KEY, "v10-public-time-machine-state"],
  {
    revalidate: SNAPSHOT_REVALIDATE_SECONDS,
    tags: ["public-dashboard"],
  },
);
