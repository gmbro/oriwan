import { unstable_cache } from "next/cache";
import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import { ACTUAL_CERTIFICATION_START_DATE, CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_DAYS, CHALLENGE_END_DATE, CHALLENGE_START_DATE, clampToChallengeStart, isCertificationParticipant } from "@/lib/challenge";
import {
  getBestWeekdayMorningProgress,
  getCurrentDateStreak,
  getLongestDateStreak,
  getWeekdayMorningProgress,
  makePersonalGrowthBadges,
  type GrowthBadgeUnlock,
} from "@/lib/growth-badges";
import { addDays, isCertificationCountedStatus, isRecoveryCertificationRecord, toIsoDate, toKstIsoDate } from "@/lib/run-records";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

const PUBLIC_DASHBOARD_REVALIDATE_SECONDS = 60;
export const PUBLIC_DASHBOARD_CACHE_CONTROL = `public, max-age=0, s-maxage=${PUBLIC_DASHBOARD_REVALIDATE_SECONDS}, stale-while-revalidate=300`;
const PUBLIC_DASHBOARD_MEMORY_CACHE_TTL_MS = PUBLIC_DASHBOARD_REVALIDATE_SECONDS * 1000;

export type PublicDashboardParticipant = {
  id: string;
  name: string;
  nickname: string | null;
  active?: boolean;
  display_order?: number;
  created_at?: string;
};

export type PublicDashboardRecord = {
  id: string;
  participant_id: string | null;
  record_date: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  status: "certified" | "needs_review" | "missing" | "rejected";
  is_recovery_certification?: boolean;
};

export type PublicDashboardPayload = {
  from: string;
  to: string;
  certification_display_start_date: string;
  challenge_start_date: string;
  challenge_end_date: string;
  generated_at: string;
  participants: PublicDashboardParticipant[];
  records: PublicDashboardRecord[];
  growth_badges: GrowthBadgeUnlock[];
  setup_required?: boolean;
  error?: string;
};

type PublicDashboardCacheEntry = {
  key: string;
  expiresAt: number;
  payload?: PublicDashboardPayload;
  promise?: Promise<PublicDashboardPayload>;
};

type GrowthBadgeInsertRow = {
  user_id: string;
  participant_id: string;
  badge_key: string;
  earned_at: string;
};

type FetchedDashboardRecord = PublicDashboardRecord & {
  source_app?: string | null;
  raw_extracted_text?: string | null;
  notes?: string | null;
};

let publicDashboardCache: PublicDashboardCacheEntry | null = null;
const actualCertificationEndDate = toIsoDate(addDays(new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`), CHALLENGE_DAYS - 1));

function makeOfficialCertificationDays() {
  const start = new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`);
  return Array.from({ length: CHALLENGE_DAYS }, (_, index) => toIsoDate(addDays(start, index)))
    .filter((day) => day <= actualCertificationEndDate);
}

function makeEligibleGrowthBadgeRows({
  adminUserId,
  participants,
  records,
  to,
}: {
  adminUserId: string;
  participants: PublicDashboardParticipant[];
  records: PublicDashboardRecord[];
  to: string;
}) {
  const earnedAt = new Date().toISOString();
  const effectiveToday = to > actualCertificationEndDate ? actualCertificationEndDate : to;
  const elapsedDayCount = makeOfficialCertificationDays().filter((day) => day <= effectiveToday).length;
  const certifiedRecords = records.filter((record) => (
    isCertificationCountedStatus(record.status) &&
    Boolean(record.participant_id && record.record_date && record.record_date >= ACTUAL_CERTIFICATION_START_DATE && record.record_date <= actualCertificationEndDate)
  ));
  const certifiedDaysByParticipant = new Map<string, Set<string>>();
  const metricsByParticipant = new Map<string, { distanceKm: number; durationSeconds: number; maxSingleDistanceKm: number }>();

  certifiedRecords.forEach((record) => {
    if (!record.participant_id || !record.record_date) return;
    if (!certifiedDaysByParticipant.has(record.participant_id)) certifiedDaysByParticipant.set(record.participant_id, new Set());
    certifiedDaysByParticipant.get(record.participant_id)?.add(record.record_date);

    const metrics = metricsByParticipant.get(record.participant_id) || { distanceKm: 0, durationSeconds: 0, maxSingleDistanceKm: 0 };
    metrics.distanceKm += record.distance_km || 0;
    metrics.durationSeconds += record.duration_seconds || 0;
    metrics.maxSingleDistanceKm = Math.max(metrics.maxSingleDistanceKm, record.distance_km || 0);
    metricsByParticipant.set(record.participant_id, metrics);
  });

  return participants.flatMap((participant) => {
    const certifiedDates = Array.from(certifiedDaysByParticipant.get(participant.id) || []).sort();
    const metrics = metricsByParticipant.get(participant.id) || { distanceKm: 0, durationSeconds: 0, maxSingleDistanceKm: 0 };
    const longestStreak = getLongestDateStreak(certifiedDates);
    const badges = makePersonalGrowthBadges({
      certifiedDays: certifiedDates.length,
      certifiedDates,
      currentStreak: getCurrentDateStreak(certifiedDates, effectiveToday),
      longestStreak,
      weekdayMorningCount: getWeekdayMorningProgress(certifiedDates, effectiveToday),
      bestWeekdayMorningCount: getBestWeekdayMorningProgress(certifiedDates),
      elapsedDayCount,
      ...metrics,
    });

    return badges
      .filter((badge) => badge.unlocked)
      .map((badge): GrowthBadgeInsertRow => ({
        user_id: adminUserId,
        participant_id: participant.id,
        badge_key: badge.key,
        earned_at: earnedAt,
      }));
  });
}

function mergeGrowthBadgeRows(rows: GrowthBadgeUnlock[]) {
  return Array.from(rows.reduce((merged, row) => {
    if (!row.participant_id || !row.badge_key) return merged;
    const key = `${row.participant_id}:${row.badge_key}`;
    if (!merged.has(key)) merged.set(key, row);
    return merged;
  }, new Map<string, GrowthBadgeUnlock>()).values());
}

async function syncGrowthBadgeRows({
  supabase,
  adminUserId,
  participants,
  records,
  to,
}: {
  supabase: ReturnType<typeof getServiceClient>;
  adminUserId: string;
  participants: PublicDashboardParticipant[];
  records: PublicDashboardRecord[];
  to: string;
}) {
  if (!supabase) return [];

  const { data: existingRows, error: existingError } = await supabase
    .from("participant_growth_badges")
    .select("participant_id, badge_key, earned_at")
    .eq("user_id", adminUserId);

  if (existingError) {
    if (!isMissingTableError(existingError)) {
      console.warn("Growth badge lookup skipped:", existingError);
    }
    return [];
  }

  const existingGrowthBadges = (existingRows || []) as GrowthBadgeUnlock[];
  const existingKeys = new Set(existingGrowthBadges.map((row) => `${row.participant_id}:${row.badge_key}`));
  const eligibleRows = makeEligibleGrowthBadgeRows({ adminUserId, participants, records, to });
  const newRows = eligibleRows.filter((row) => !existingKeys.has(`${row.participant_id}:${row.badge_key}`));

  if (!newRows.length) return mergeGrowthBadgeRows(existingGrowthBadges);

  const { data: insertedRows, error: insertError } = await supabase
    .from("participant_growth_badges")
    .upsert(newRows, {
      onConflict: "user_id,participant_id,badge_key",
      ignoreDuplicates: true,
    })
    .select("participant_id, badge_key, earned_at");

  if (insertError) {
    if (!isMissingTableError(insertError)) {
      console.warn("Growth badge persistence skipped:", insertError);
    }
    return mergeGrowthBadgeRows(existingGrowthBadges);
  }

  return mergeGrowthBadgeRows([
    ...existingGrowthBadges,
    ...((insertedRows || []) as GrowthBadgeUnlock[]),
    ...newRows.map((row) => ({
      participant_id: row.participant_id,
      badge_key: row.badge_key,
      earned_at: row.earned_at,
    })),
  ]);
}

export function getPublicDashboardDateRange({
  scope,
  daysParam,
  today = toKstIsoDate(),
}: {
  scope?: string | null;
  daysParam?: number;
  today?: string;
}) {
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam || 30, 7), 366) : 30;
  const to = today;
  const rangeEnd = new Date(`${to}T00:00:00`);
  const from = scope === "all" ? CHALLENGE_START_DATE : clampToChallengeStart(toIsoDate(addDays(rangeEnd, -(days - 1))));
  const cacheKey = `${scope || "range"}:${from}:${to}`;

  return { from, to, cacheKey };
}

export async function buildPublicDashboardPayload(from: string, to: string): Promise<PublicDashboardPayload> {
  const supabase = getServiceClient();
  if (!supabase) throw new Error("공개 대시보드 환경변수가 설정되지 않았습니다.");

  const adminUserId = await findAdminUserId(supabase);
  if (!adminUserId) throw new Error("관리자 계정을 찾지 못했습니다.");

  const [participantsResult, recordsResult] = await Promise.all([
    supabase
      .from("participants")
      .select("id, name, nickname, active, display_order, created_at")
      .eq("user_id", adminUserId)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("daily_run_records")
      .select(`
        id,
        participant_id,
        record_date,
        distance_km,
        duration_seconds,
        status,
        source_app,
        raw_extracted_text,
        notes
      `)
      .eq("user_id", adminUserId)
      .in("status", ["certified", "needs_review"])
      .gte("record_date", from)
      .lte("record_date", to)
      .order("record_date", { ascending: false }),
  ]);

  if (isMissingTableError(participantsResult.error) || isMissingTableError(recordsResult.error)) {
    return {
      from,
      to,
      certification_display_start_date: CERTIFICATION_DISPLAY_START_DATE,
      challenge_start_date: CHALLENGE_START_DATE,
      challenge_end_date: CHALLENGE_END_DATE,
      generated_at: new Date().toISOString(),
      participants: [],
      records: [],
      growth_badges: [],
      ...missingSchemaResponse("Supabase에 멤버/기록 테이블을 먼저 준비해주세요."),
    };
  }

  if (participantsResult.error) throw participantsResult.error;
  if (recordsResult.error) throw recordsResult.error;

  const participants = ((participantsResult.data || []) as PublicDashboardParticipant[])
    .filter(isCertificationParticipant);
  const visibleParticipantIds = new Set(participants.map((participant) => participant.id));
  const records = ((recordsResult.data || []) as FetchedDashboardRecord[])
    .filter((record) => Boolean(record.participant_id && visibleParticipantIds.has(record.participant_id)))
    .map((record) => ({
      id: record.id,
      participant_id: record.participant_id,
      record_date: record.record_date,
      distance_km: record.distance_km,
      duration_seconds: record.duration_seconds,
      status: record.status,
      is_recovery_certification: isRecoveryCertificationRecord(record),
    }));
  const growthBadges = (await syncGrowthBadgeRows({
    supabase,
    adminUserId,
    participants,
    records,
    to,
  })).filter((badge) => Boolean(badge.participant_id && visibleParticipantIds.has(badge.participant_id)));

  return {
    from,
    to,
    certification_display_start_date: CERTIFICATION_DISPLAY_START_DATE,
    challenge_start_date: CHALLENGE_START_DATE,
    challenge_end_date: CHALLENGE_END_DATE,
    generated_at: new Date().toISOString(),
    participants,
    records,
    growth_badges: growthBadges,
  };
}

const getCachedPublicDashboardPayload = unstable_cache(
  async (from: string, to: string) => buildPublicDashboardPayload(from, to),
  ["public-dashboard-payload"],
  {
    revalidate: PUBLIC_DASHBOARD_REVALIDATE_SECONDS,
    tags: ["public-dashboard"],
  }
);

export async function getPublicDashboardPayload(cacheKey: string, from: string, to: string, bypassCache = false) {
  const now = Date.now();
  if (!bypassCache && publicDashboardCache?.key === cacheKey) {
    if (publicDashboardCache.payload && publicDashboardCache.expiresAt > now) {
      return { payload: publicDashboardCache.payload, cacheStatus: "HIT" };
    }
    if (publicDashboardCache.promise) {
      return { payload: await publicDashboardCache.promise, cacheStatus: "DEDUPED" };
    }
  }

  const promise = bypassCache
    ? buildPublicDashboardPayload(from, to)
    : getCachedPublicDashboardPayload(from, to);
  if (!bypassCache) {
    publicDashboardCache = { key: cacheKey, expiresAt: 0, payload: publicDashboardCache?.payload, promise };
  }

  try {
    const payload = await promise;
    if (!bypassCache) {
      publicDashboardCache = {
        key: cacheKey,
        expiresAt: Date.now() + PUBLIC_DASHBOARD_MEMORY_CACHE_TTL_MS,
        payload,
      };
    }

    return { payload, cacheStatus: bypassCache ? "BYPASS" : "MISS" };
  } catch (error) {
    if (!bypassCache && publicDashboardCache?.key === cacheKey && publicDashboardCache.payload) {
      publicDashboardCache = {
        key: cacheKey,
        expiresAt: Date.now() + PUBLIC_DASHBOARD_MEMORY_CACHE_TTL_MS,
        payload: publicDashboardCache.payload,
      };
      return { payload: publicDashboardCache.payload, cacheStatus: "STALE" };
    }

    if (!bypassCache && publicDashboardCache?.key === cacheKey) {
      publicDashboardCache = null;
    }
    throw error;
  }
}
