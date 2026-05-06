import { addDays, toIsoDate } from "@/lib/run-records";

export type ScoreParticipant = {
  id: string;
  name: string;
};

export type ScoreRecord = {
  participant_id: string | null;
  record_date: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  pace_seconds_per_km: number | null;
  status: string;
};

export type ScoreBadgeKind = "praise" | "encourage";

export type ScoreRow = {
  participant: ScoreParticipant;
  certifiedCount: number;
  distance: number;
  time: number;
  currentStreak: number;
  longestStreak: number;
  growthDays: number;
  score: number;
  averageScore: number;
  badgeKind: ScoreBadgeKind;
  breakdown: {
    certification: number;
    consistency: number;
    growth: number;
    time: number;
    distance: number;
  };
};

export const SCORE_WEIGHTS = {
  certification: 12,
  consistency: 12,
  growth: 14,
  timePerHour: 5,
  distancePerKm: 2,
} as const;

function getDaySet(records: ScoreRecord[]) {
  return new Set(records.map((record) => record.record_date).filter(Boolean) as string[]);
}

function getCurrentStreak(daySet: Set<string>, referenceDate: string, challengeStartDate: string) {
  let cursor = new Date(`${referenceDate}T00:00:00`);
  let streak = 0;

  while (toIsoDate(cursor) >= challengeStartDate) {
    const day = toIsoDate(cursor);
    if (!daySet.has(day)) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function getLongestStreak(daySet: Set<string>, challengeStartDate: string, referenceDate: string) {
  let cursor = new Date(`${challengeStartDate}T00:00:00`);
  let current = 0;
  let longest = 0;

  while (toIsoDate(cursor) <= referenceDate) {
    if (daySet.has(toIsoDate(cursor))) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    cursor = addDays(cursor, 1);
  }

  return longest;
}

function getGrowthDays(records: ScoreRecord[]) {
  let bestDistance = 0;
  let bestPace = Number.POSITIVE_INFINITY;
  let growthDays = 0;

  records.forEach((record, index) => {
    const distance = record.distance_km || 0;
    const pace = record.pace_seconds_per_km || Number.POSITIVE_INFINITY;
    const improved = index > 0 && ((distance > bestDistance && distance > 0) || pace < bestPace);

    if (improved) growthDays += 1;
    bestDistance = Math.max(bestDistance, distance);
    bestPace = Math.min(bestPace, pace);
  });

  return growthDays;
}

export function buildScoreRows({
  participants,
  records,
  challengeStartDate,
  referenceDate,
}: {
  participants: ScoreParticipant[];
  records: ScoreRecord[];
  challengeStartDate: string;
  referenceDate: string;
}) {
  const certifiedRecords = records.filter((record) => record.status === "certified" && record.participant_id && record.record_date);

  const rows = participants.map((participant) => {
    const participantRecords = certifiedRecords
      .filter((record) => record.participant_id === participant.id)
      .sort((a, b) => String(a.record_date).localeCompare(String(b.record_date)));
    const daySet = getDaySet(participantRecords);
    const certifiedCount = participantRecords.length;
    const distance = participantRecords.reduce((sum, record) => sum + (record.distance_km || 0), 0);
    const time = participantRecords.reduce((sum, record) => sum + (record.duration_seconds || 0), 0);
    const currentStreak = getCurrentStreak(daySet, referenceDate, challengeStartDate);
    const longestStreak = getLongestStreak(daySet, challengeStartDate, referenceDate);
    const growthDays = getGrowthDays(participantRecords);
    const breakdown = {
      certification: certifiedCount * SCORE_WEIGHTS.certification,
      consistency: longestStreak * SCORE_WEIGHTS.consistency,
      growth: growthDays * SCORE_WEIGHTS.growth,
      time: Math.round((time / 3600) * SCORE_WEIGHTS.timePerHour),
      distance: Math.round(distance * SCORE_WEIGHTS.distancePerKm),
    };
    const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

    return {
      participant,
      certifiedCount,
      distance,
      time,
      currentStreak,
      longestStreak,
      growthDays,
      score,
      averageScore: 0,
      badgeKind: "encourage" as ScoreBadgeKind,
      breakdown,
    };
  });

  const averageScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0;

  return rows
    .map((row) => ({
      ...row,
      averageScore,
      badgeKind: row.score >= averageScore ? "praise" as ScoreBadgeKind : "encourage" as ScoreBadgeKind,
    }))
    .sort((a, b) => b.score - a.score || a.participant.name.localeCompare(b.participant.name, "ko"));
}
