import {
  FOURTH_PERSONAL_RECORD_START_DATE,
  FOURTH_SEASON_DAYS,
  FOURTH_SEASON_END_DATE,
  FOURTH_SEASON_KEY,
  FOURTH_SEASON_START_DATE,
} from "@/lib/fourth-season-contract";

export type PersonalRunRecordStatus = "certified" | "needs_review" | "missing" | "rejected";
export type PersonalRunRecordPhase = "preseason" | "official";
export type PersonalSeasonPhase = "preseason" | "active" | "complete";

export type PersonalRunRecord = {
  id: string;
  date: string;
  status: PersonalRunRecordStatus;
  phase: PersonalRunRecordPhase;
  countsTowardOfficial: boolean;
  distanceKm: number | null;
  durationSeconds: number | null;
  paceSecondsPerKm: number | null;
  isRecovery: boolean;
};

export type PersonalCalendarDay = {
  date: string;
  dayNumber: number;
  state: "future" | "missed" | "review" | "certified" | "recovery";
};

export type PersonalWeeklyProgress = {
  weekNumber: number;
  from: string;
  to: string;
  targetDays: number;
  elapsedDays: number;
  certifiedDays: number;
  distanceKm: number;
};

export type PersonalCumulativeDistancePoint = {
  date: string;
  phase: PersonalRunRecordPhase;
  cumulativeKm: number;
};

type PersonalSummary = {
  certifiedDays: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
};

export type PersonalRecordsPayload = {
  schemaVersion: 1;
  season: {
    key: typeof FOURTH_SEASON_KEY;
    personalRecordStartDate: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    today: string;
    phase: PersonalSeasonPhase;
    elapsedOfficialDays: number;
  };
  summary: {
    official: PersonalSummary & {
      certificationRate: number | null;
      currentStreak: number;
      longestStreak: number;
      averagePaceSecondsPerKm: number | null;
    };
    preseason: PersonalSummary;
  };
  series: {
    calendar: PersonalCalendarDay[];
    weekly: PersonalWeeklyProgress[];
    cumulativeDistance: PersonalCumulativeDistancePoint[];
  };
  records: PersonalRunRecord[];
  generatedAt: string;
};

export type PersonalRunRecordInput = Omit<PersonalRunRecord, "phase" | "countsTowardOfficial">;

const DAY_MS = 86_400_000;

function isoDateToUtcMs(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

function addDays(value: string, count: number) {
  return new Date(isoDateToUtcMs(value) + count * DAY_MS).toISOString().slice(0, 10);
}

function inclusiveDayCount(from: string, to: string) {
  if (from > to) return 0;
  return Math.floor((isoDateToUtcMs(to) - isoDateToUtcMs(from)) / DAY_MS) + 1;
}

function roundDistance(value: number) {
  return Math.round(value * 100) / 100;
}

function makePhase(date: string): PersonalRunRecordPhase {
  return date < FOURTH_SEASON_START_DATE ? "preseason" : "official";
}

function uniqueCertifiedRecords(records: PersonalRunRecord[]) {
  const byDate = new Map<string, PersonalRunRecord>();
  records.forEach((record) => {
    if (record.status !== "certified") return;
    const current = byDate.get(record.date);
    if (!current || (current.isRecovery && !record.isRecovery)) byDate.set(record.date, record);
  });
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function recordsByPreferredDailyState(records: PersonalRunRecord[]) {
  const statusPriority: Record<PersonalRunRecordStatus, number> = {
    certified: 4,
    needs_review: 3,
    rejected: 2,
    missing: 1,
  };
  const byDate = new Map<string, PersonalRunRecord>();

  records.forEach((record) => {
    const current = byDate.get(record.date);
    const shouldReplace = !current
      || statusPriority[record.status] > statusPriority[current.status]
      || (
        record.status === "certified"
        && current.status === "certified"
        && current.isRecovery
        && !record.isRecovery
      );
    if (shouldReplace) byDate.set(record.date, record);
  });

  return byDate;
}

function summarize(records: PersonalRunRecord[]): PersonalSummary {
  const certifiedRecords = uniqueCertifiedRecords(records);
  return {
    certifiedDays: certifiedRecords.length,
    totalDistanceKm: roundDistance(certifiedRecords.reduce((sum, record) => sum + (record.distanceKm || 0), 0)),
    totalDurationSeconds: certifiedRecords.reduce((sum, record) => sum + (record.durationSeconds || 0), 0),
  };
}

function longestStreak(dates: string[]) {
  if (dates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let index = 1; index < dates.length; index += 1) {
    if (inclusiveDayCount(dates[index - 1], dates[index]) === 2) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

function currentStreak(dates: Set<string>, throughDate: string | null) {
  if (!throughDate || !dates.has(throughDate)) return 0;
  let count = 0;
  let cursor = throughDate;
  while (dates.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function makeCalendar(recordsByDate: Map<string, PersonalRunRecord>, today: string): PersonalCalendarDay[] {
  return Array.from({ length: FOURTH_SEASON_DAYS }, (_, index) => {
    const date = addDays(FOURTH_SEASON_START_DATE, index);
    const record = recordsByDate.get(date);
    let state: PersonalCalendarDay["state"] = "missed";
    if (date > today) state = "future";
    else if (record?.status === "certified") state = record.isRecovery ? "recovery" : "certified";
    else if (record?.status === "needs_review") state = "review";

    return { date, dayNumber: index + 1, state };
  });
}

function makeWeeks(officialRecords: PersonalRunRecord[], today: string): PersonalWeeklyProgress[] {
  const certifiedByDate = new Map(uniqueCertifiedRecords(officialRecords).map((record) => [record.date, record]));
  return Array.from({ length: Math.ceil(FOURTH_SEASON_DAYS / 7) }, (_, index) => {
    const from = addDays(FOURTH_SEASON_START_DATE, index * 7);
    const days = Array.from(
      { length: Math.min(7, FOURTH_SEASON_DAYS - index * 7) },
      (_value, dayIndex) => addDays(from, dayIndex),
    );
    const records = days.flatMap((date) => {
      const record = certifiedByDate.get(date);
      return record ? [record] : [];
    });
    return {
      weekNumber: index + 1,
      from,
      to: days.at(-1) || from,
      targetDays: days.length,
      elapsedDays: days.filter((date) => date <= today).length,
      certifiedDays: records.length,
      distanceKm: roundDistance(records.reduce((sum, record) => sum + (record.distanceKm || 0), 0)),
    };
  });
}

function makeCumulativeDistance(records: PersonalRunRecord[]) {
  const totals: Record<PersonalRunRecordPhase, number> = { preseason: 0, official: 0 };
  return uniqueCertifiedRecords(records).map((record): PersonalCumulativeDistancePoint => {
    totals[record.phase] += record.distanceKm || 0;
    return {
      date: record.date,
      phase: record.phase,
      cumulativeKm: roundDistance(totals[record.phase]),
    };
  });
}

export function buildPersonalRecordsPayload(
  inputRecords: PersonalRunRecordInput[],
  today: string,
): PersonalRecordsPayload {
  const visibleThroughDate = today > FOURTH_SEASON_END_DATE ? FOURTH_SEASON_END_DATE : today;
  const normalizedRecords = inputRecords
    .filter((record) => (
      /^\d{4}-\d{2}-\d{2}$/.test(record.date)
      && record.date >= FOURTH_PERSONAL_RECORD_START_DATE
      && record.date <= visibleThroughDate
    ))
    .map((record): PersonalRunRecord => {
      const phase = makePhase(record.date);
      return {
        ...record,
        phase,
        countsTowardOfficial: false,
      };
    })
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));

  const countedOfficialRecordIds = new Set(
    uniqueCertifiedRecords(normalizedRecords.filter((record) => record.phase === "official"))
      .map((record) => record.id),
  );
  const records = normalizedRecords.map((record) => ({
    ...record,
    countsTowardOfficial: countedOfficialRecordIds.has(record.id),
  }));

  const preseasonRecords = records.filter((record) => record.phase === "preseason");
  const officialRecords = records.filter((record) => record.phase === "official");
  const officialCertified = uniqueCertifiedRecords(officialRecords);
  const officialDates = officialCertified.map((record) => record.date);
  const officialDateSet = new Set(officialDates);
  const officialSummary = summarize(officialRecords);
  const preseasonSummary = summarize(preseasonRecords);
  const elapsedOfficialDays = today < FOURTH_SEASON_START_DATE
    ? 0
    : Math.min(FOURTH_SEASON_DAYS, inclusiveDayCount(FOURTH_SEASON_START_DATE, visibleThroughDate));
  const paceRecords = officialCertified.filter((record) => (
    !record.isRecovery
    && Boolean(record.distanceKm && record.distanceKm > 0)
    && Boolean(record.durationSeconds && record.durationSeconds > 0)
  ));
  const paceDistance = paceRecords.reduce((sum, record) => sum + (record.distanceKm || 0), 0);
  const paceDuration = paceRecords.reduce((sum, record) => sum + (record.durationSeconds || 0), 0);
  const recordsByOfficialDate = recordsByPreferredDailyState(officialRecords);
  const activeThroughDate = elapsedOfficialDays > 0 ? addDays(FOURTH_SEASON_START_DATE, elapsedOfficialDays - 1) : null;

  return {
    schemaVersion: 1,
    season: {
      key: FOURTH_SEASON_KEY,
      personalRecordStartDate: FOURTH_PERSONAL_RECORD_START_DATE,
      startDate: FOURTH_SEASON_START_DATE,
      endDate: FOURTH_SEASON_END_DATE,
      totalDays: FOURTH_SEASON_DAYS,
      today,
      phase: today < FOURTH_SEASON_START_DATE ? "preseason" : today <= FOURTH_SEASON_END_DATE ? "active" : "complete",
      elapsedOfficialDays,
    },
    summary: {
      official: {
        ...officialSummary,
        certificationRate: elapsedOfficialDays > 0
          ? Math.min(100, Math.round((officialSummary.certifiedDays / elapsedOfficialDays) * 100))
          : null,
        currentStreak: currentStreak(officialDateSet, activeThroughDate),
        longestStreak: longestStreak(officialDates),
        averagePaceSecondsPerKm: paceDistance > 0 ? Math.round(paceDuration / paceDistance) : null,
      },
      preseason: preseasonSummary,
    },
    series: {
      calendar: makeCalendar(recordsByOfficialDate, today),
      weekly: makeWeeks(officialRecords, today),
      cumulativeDistance: makeCumulativeDistance(records),
    },
    records,
    generatedAt: new Date().toISOString(),
  };
}
