import "server-only";

import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import {
  FOURTH_SEASON_DAYS,
  FOURTH_SEASON_END_DATE,
  FOURTH_SEASON_KEY,
  FOURTH_SEASON_START_DATE,
} from "@/lib/fourth-season-contract";
import type { Hello2027Participant, Hello2027Snapshot } from "@/lib/hello-2027-types";
import { toKstIsoDate } from "@/lib/run-records";
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

type RecordRow = {
  participant_id: string | null;
  record_date: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  created_at: string | null;
};

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
  participantIds,
  throughDate,
}: {
  service: SupabaseClient;
  adminUserId: string;
  participantIds: string[];
  throughDate: string;
}) {
  if (participantIds.length === 0 || throughDate < FOURTH_SEASON_START_DATE) {
    return { rows: [] as RecordRow[], error: null };
  }

  const rows: RecordRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await service
      .from("daily_run_records")
      .select("participant_id, record_date, distance_km, duration_seconds, created_at")
      .eq("user_id", adminUserId)
      .eq("season_key", FOURTH_SEASON_KEY)
      .eq("status", "certified")
      .in("participant_id", participantIds)
      .gte("record_date", FOURTH_SEASON_START_DATE)
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
  today,
}: {
  participants: ParticipantRow[];
  records: RecordRow[];
  today: string;
}): Hello2027Snapshot {
  const participantIds = new Set(participants.map((participant) => participant.id));
  const lastRecordByParticipantDate = new Map<string, RecordRow>();

  records.forEach((record) => {
    if (
      !record.participant_id
      || !participantIds.has(record.participant_id)
      || !record.record_date
      || record.record_date < FOURTH_SEASON_START_DATE
      || record.record_date > FOURTH_SEASON_END_DATE
    ) return;
    const key = `${record.participant_id}:${record.record_date}`;
    if (!lastRecordByParticipantDate.has(key)) lastRecordByParticipantDate.set(key, record);
  });

  const recordsByParticipant = new Map<string, RecordRow[]>();
  lastRecordByParticipantDate.forEach((record) => {
    if (!record.participant_id) return;
    const participantRecords = recordsByParticipant.get(record.participant_id) || [];
    participantRecords.push(record);
    recordsByParticipant.set(record.participant_id, participantRecords);
  });

  const dayNumber = getDayNumber(today);
  const visibleThroughDate = today > FOURTH_SEASON_END_DATE ? FOURTH_SEASON_END_DATE : today;
  const realParticipants: Hello2027Participant[] = participants.map((participant) => {
    const participantRecords = recordsByParticipant.get(participant.id) || [];
    const todayRecord = today >= FOURTH_SEASON_START_DATE && today <= FOURTH_SEASON_END_DATE
      ? participantRecords.find((record) => record.record_date === today)
      : undefined;

    return {
      id: participant.id,
      fullName: participant.name,
      pictogramIndex: pictogramIndexForParticipant(participant.id),
      completed: Boolean(todayRecord),
      seasonCompletionRate: dayNumber > 0
        ? Math.round((participantRecords.length / dayNumber) * 100)
        : 0,
      distanceKm: cleanFiniteNumber(todayRecord?.distance_km),
      durationMinutes: cleanFiniteNumber(todayRecord?.duration_seconds) === null
        ? null
        : Math.max(1, Math.round((todayRecord?.duration_seconds || 0) / 60)),
      product: {
        name: `${participant.name}님의 이야기`,
        description: "운영자가 공개 자기소개를 준비하고 있어요.",
      },
    };
  });

  const countRate = (from: string, to: string) => {
    const periodDays = inclusiveDayCount(from, to);
    if (periodDays === 0) return 0;
    const completedSlots = Array.from(lastRecordByParticipantDate.values()).filter((record) => (
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

    const { data, error } = await service
      .from("participants")
      .select("id, name, display_order, created_at")
      .eq("user_id", adminUserId)
      .eq("season_key", FOURTH_SEASON_KEY)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(MAX_LIVE_PARTICIPANTS);

    if (error) return emptySnapshot;

    const participants = ((data || []) as ParticipantRow[]).flatMap((participant) => {
      const id = cleanText(participant.id, 100);
      const name = cleanText(participant.name, 40);
      return id && name ? [{ ...participant, id, name }] : [];
    });
    if (participants.length === 0) return emptySnapshot;

    const throughDate = today > FOURTH_SEASON_END_DATE ? FOURTH_SEASON_END_DATE : today;
    const recordsResult = await fetchFourthRecords({
      service,
      adminUserId,
      participantIds: participants.map((participant) => participant.id),
      throughDate,
    });
    if (recordsResult.error) return emptySnapshot;

    return buildLiveSnapshot({ participants, records: recordsResult.rows, today });
  } catch (error) {
    logServerFailure("Hello 2027 live snapshot", error);
    return emptySnapshot;
  }
}

export const getHello2027DashboardSnapshot = unstable_cache(
  loadHello2027DashboardSnapshot,
  ["hello-2027-dashboard", FOURTH_SEASON_KEY, "v3-dummy-free"],
  {
    revalidate: SNAPSHOT_REVALIDATE_SECONDS,
    tags: ["public-dashboard"],
  },
);
