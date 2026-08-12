import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import { ACTUAL_CERTIFICATION_START_DATE, CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_DAYS, CHALLENGE_END_DATE, CHALLENGE_START_DATE, clampToChallengeStart, isCertificationParticipant } from "@/lib/challenge";
import {
  getPersonalGrowthBadgeEarnedDates,
  isKnownGrowthBadgeKey,
  PERSONAL_GROWTH_BADGE_KEYS,
  type GrowthBadgeUnlock,
} from "@/lib/growth-badges";
import { addDays, getCertificationCreditMetrics, isCertificationCountedStatus, isRecoveryCertificationRecord, toIsoDate, toKstIsoDate } from "@/lib/run-records";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

const PUBLIC_DASHBOARD_REVALIDATE_SECONDS = 60;
const PUBLIC_DASHBOARD_PAYLOAD_VERSION = "recovery-growth-credit-v1";
export const PUBLIC_DASHBOARD_CACHE_TAG = "public-dashboard";
export const PUBLIC_DASHBOARD_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";
const PUBLIC_DASHBOARD_MEMORY_CACHE_TTL_MS = PUBLIC_DASHBOARD_REVALIDATE_SECONDS * 1000;
const DASHBOARD_RECORDS_PAGE_SIZE = 1000;

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
  space_label?: string | null;
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

const RUN_LOCATION_PATTERNS = [
  { label: "서울 성수", patterns: [/seongsu|seoul forest/i], compactPatterns: [/성수(?:동|역)?|서울숲/] },
  { label: "서울 여의도", patterns: [/yeouido|yeouinaru/i], compactPatterns: [/여의도|여의나루|샛강/] },
  { label: "서울 잠실", patterns: [/jamsil|seokchon/i], compactPatterns: [/잠실|석촌/] },
  { label: "서울 강남", patterns: [/gangnam|apgujeong|sinsa|cheongdam|yeoksam|seolleung|samseong/i], compactPatterns: [/강남|압구정|신사|청담|역삼|선릉|삼성(?:동|역)/] },
  { label: "서울 서초", patterns: [/seocho|banpo|yangjae|jamwon/i], compactPatterns: [/서초|반포|양재|잠원/] },
  { label: "서울 송파", patterns: [/songpa|olympic park|olympicpark|bangi|garak|munjeong/i], compactPatterns: [/송파|올림픽공원|방이|가락|문정/] },
  { label: "서울 마포", patterns: [/mapo|sangam|mangwon|hongdae|hapjeong/i], compactPatterns: [/마포|상암|망원|홍대|합정/] },
  { label: "서울 성동", patterns: [/seongdong|wangsimni|oksu|geumho|eungbong/i], compactPatterns: [/성동|왕십리|옥수|금호|응봉/] },
  { label: "서울 광진", patterns: [/gwangjin|achasan|guui|konkuk|ttukseom/i], compactPatterns: [/광진|아차산|구의|건대|어린이대공원|뚝섬유원지/] },
  { label: "서울 한강", patterns: [/hangang|han river|riverside/i], compactPatterns: [/한강|강변|잠수교/] },
  { label: "남양주", patterns: [/namyangju|dasan|byeollae|deokso/i], compactPatterns: [/남양주|다산|별내|덕소|와부|진접|오남|퇴계원|평내|호평|마석|화도|진건|금곡/] },
  { label: "하남", patterns: [/hanam|misa/i], compactPatterns: [/하남|미사/] },
  { label: "구리", patterns: [/guri/i], compactPatterns: [/구리/] },
  { label: "수원 광교", patterns: [/gwanggyo/i], compactPatterns: [/광교/] },
  { label: "수원", patterns: [/suwon/i], compactPatterns: [/수원/] },
  { label: "성남 판교", patterns: [/pangyo|bundang/i], compactPatterns: [/판교|분당/] },
  { label: "성남", patterns: [/seongnam/i], compactPatterns: [/성남/] },
  { label: "고양 일산", patterns: [/ilsan/i], compactPatterns: [/일산/] },
  { label: "고양", patterns: [/goyang/i], compactPatterns: [/고양/] },
  { label: "인천", patterns: [/incheon/i], compactPatterns: [/인천|송도|청라/] },
  { label: "부산", patterns: [/busan/i], compactPatterns: [/부산|해운대|광안리/] },
  { label: "제주", patterns: [/jeju/i], compactPatterns: [/제주/] },
  { label: "서울", patterns: [/seoul/i], compactPatterns: [/서울|종로|중구|용산|동대문|중랑|성북|강북|도봉|노원|은평|서대문|양천|강서|구로|금천|영등포|동작|관악|강동/] },
];

let publicDashboardCache: PublicDashboardCacheEntry | null = null;
const actualCertificationEndDate = toIsoDate(addDays(new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`), CHALLENGE_DAYS - 1));

function makeRecordSpaceLabel(record: FetchedDashboardRecord) {
  if (isRecoveryCertificationRecord(record)) return "기타";

  const searchableText = (record.raw_extracted_text || "").replace(/\s+/g, " ").trim();
  const compactText = searchableText.replace(/\s+/g, "");
  if (!searchableText) return "기타";

  const matchedLocation = RUN_LOCATION_PATTERNS.find((location) => (
    location.patterns.some((pattern) => pattern.test(searchableText)) ||
    location.compactPatterns.some((pattern) => pattern.test(compactText))
  ));
  if (matchedLocation) return matchedLocation.label;

  return "기타";
}

async function fetchDashboardRecords({
  supabase,
  adminUserId,
  from,
  to,
}: {
  supabase: SupabaseClient;
  adminUserId: string;
  from: string;
  to: string;
}): Promise<{ data: FetchedDashboardRecord[]; error: PostgrestError | null }> {
  const records: FetchedDashboardRecord[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
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
      .order("record_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + DASHBOARD_RECORDS_PAGE_SIZE - 1);

    if (error) return { data: records, error };

    const page = (data || []) as FetchedDashboardRecord[];
    records.push(...page);
    if (page.length < DASHBOARD_RECORDS_PAGE_SIZE) break;
    offset += DASHBOARD_RECORDS_PAGE_SIZE;
  }

  return { data: records, error: null };
}

function makeCalculatedGrowthBadgeRows({
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
  const certifiedRecords = records.filter((record) => (
    isCertificationCountedStatus(record.status) &&
    Boolean(record.participant_id && record.record_date && record.record_date >= ACTUAL_CERTIFICATION_START_DATE && record.record_date <= actualCertificationEndDate)
  ));
  const recordsByParticipant = new Map<string, PublicDashboardRecord[]>();

  certifiedRecords.forEach((record) => {
    if (!record.participant_id || !record.record_date) return;
    const participantRecords = recordsByParticipant.get(record.participant_id) || [];
    participantRecords.push(record);
    recordsByParticipant.set(record.participant_id, participantRecords);
  });

  return participants.flatMap((participant) => {
    const earnedDates = getPersonalGrowthBadgeEarnedDates(
      (recordsByParticipant.get(participant.id) || []).flatMap((record) => (
        record.record_date
          ? [{
              recordDate: record.record_date,
              distanceKm: record.distance_km || 0,
              durationSeconds: record.duration_seconds || 0,
            }]
          : []
      ))
    );

    return PERSONAL_GROWTH_BADGE_KEYS.flatMap((badgeKey): GrowthBadgeInsertRow[] => {
      const earnedDate = earnedDates[badgeKey];
      if (!earnedDate || earnedDate > to) return [];

      return [{
        user_id: adminUserId,
        participant_id: participant.id,
        badge_key: badgeKey,
        earned_at: new Date(`${earnedDate}T12:00:00+09:00`).toISOString(),
      }];
    });
  });
}

function mergeGrowthBadgeRows(rows: GrowthBadgeUnlock[]) {
  return Array.from(rows.reduce((merged, row) => {
    if (!row.participant_id || !row.badge_key) return merged;
    if (!isKnownGrowthBadgeKey(row.badge_key)) return merged;
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
  from,
  to,
}: {
  supabase: ReturnType<typeof getServiceClient>;
  adminUserId: string;
  participants: PublicDashboardParticipant[];
  records: PublicDashboardRecord[];
  from: string;
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
  if (from > ACTUAL_CERTIFICATION_START_DATE) {
    return mergeGrowthBadgeRows(existingGrowthBadges);
  }

  const calculatedRows = makeCalculatedGrowthBadgeRows({ adminUserId, participants, records, to });
  const existingGrowthBadgesByKey = new Map(
    existingGrowthBadges.map((row) => [`${row.participant_id}:${row.badge_key}`, row])
  );
  const changedRows = calculatedRows.filter((row) => {
    const key = `${row.participant_id}:${row.badge_key}`;
    const existingRow = existingGrowthBadgesByKey.get(key);
    if (!existingRow?.earned_at) return true;
    return Date.parse(existingRow.earned_at) !== Date.parse(row.earned_at);
  });

  if (!changedRows.length) {
    return mergeGrowthBadgeRows([...calculatedRows, ...existingGrowthBadges]);
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("participant_growth_badges")
    .upsert(changedRows, {
      onConflict: "user_id,participant_id,badge_key",
    })
    .select("participant_id, badge_key, earned_at");

  if (updateError) {
    if (!isMissingTableError(updateError)) {
      console.warn("Growth badge persistence skipped:", updateError);
    }
    return mergeGrowthBadgeRows([...calculatedRows, ...existingGrowthBadges]);
  }

  return mergeGrowthBadgeRows([
    ...calculatedRows,
    ...((updatedRows || []) as GrowthBadgeUnlock[]),
    ...existingGrowthBadges,
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
  const cacheKey = `${PUBLIC_DASHBOARD_PAYLOAD_VERSION}:${scope || "range"}:${from}:${to}`;

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
    fetchDashboardRecords({ supabase, adminUserId, from, to }),
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
    .map((record) => {
      const creditMetrics = getCertificationCreditMetrics(record);
      return {
        id: record.id,
        participant_id: record.participant_id,
        record_date: record.record_date,
        distance_km: creditMetrics.distanceKm,
        duration_seconds: creditMetrics.durationSeconds,
        status: record.status,
        space_label: makeRecordSpaceLabel(record),
        is_recovery_certification: creditMetrics.isRecoveryCertification,
      };
    });
  const growthBadges = (await syncGrowthBadgeRows({
    supabase,
    adminUserId,
    participants,
    records,
    from,
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
  ["public-dashboard-payload", PUBLIC_DASHBOARD_PAYLOAD_VERSION],
  {
    revalidate: PUBLIC_DASHBOARD_REVALIDATE_SECONDS,
    tags: [PUBLIC_DASHBOARD_CACHE_TAG],
  }
);

export function invalidatePublicDashboardCache() {
  publicDashboardCache = null;
  revalidateTag(PUBLIC_DASHBOARD_CACHE_TAG, { expire: 0 });
  revalidatePath("/dashboard");
  revalidatePath("/api/public-dashboard");
  revalidatePath("/dashboard/report");
  revalidatePath("/dashboard/report/[participantId]", "page");
}

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
