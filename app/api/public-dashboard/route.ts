import { NextRequest, NextResponse } from "next/server";
import { addDays, toIsoDate, toKstIsoDate } from "@/lib/run-records";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import { CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_END_DATE, CHALLENGE_START_DATE, clampToChallengeStart } from "@/lib/challenge";
import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import { guardReadRequest } from "@/lib/request-security";

const PUBLIC_DASHBOARD_CACHE_CONTROL = "public, max-age=0, s-maxage=5, stale-while-revalidate=30";
const PUBLIC_DASHBOARD_MEMORY_CACHE_TTL_MS = 5_000;
const PUBLIC_DASHBOARD_RATE_LIMIT = {
  key: "public-dashboard-read",
  limit: 180,
  windowMs: 60_000,
  message: "대시보드 요청이 잠시 몰렸어요. 조금 뒤 새로고침해주세요.",
};

type PublicDashboardPayload = {
  from: string;
  to: string;
  certification_display_start_date: string;
  challenge_start_date: string;
  challenge_end_date: string;
  generated_at: string;
  participants: unknown[];
  records: unknown[];
  setup_required?: boolean;
  error?: string;
};

type PublicDashboardCacheEntry = {
  key: string;
  expiresAt: number;
  payload?: PublicDashboardPayload;
  promise?: Promise<PublicDashboardPayload>;
};

let publicDashboardCache: PublicDashboardCacheEntry | null = null;

function publicDashboardResponse(payload: unknown, cacheStatus = "MISS") {
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", PUBLIC_DASHBOARD_CACHE_CONTROL);
  response.headers.set("X-Oriwan-Cache", cacheStatus);
  return response;
}

async function buildPublicDashboardPayload(from: string, to: string): Promise<PublicDashboardPayload> {
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
        status
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
      ...missingSchemaResponse("Supabase에 멤버/기록 테이블을 먼저 준비해주세요."),
    };
  }

  if (participantsResult.error) throw participantsResult.error;
  if (recordsResult.error) throw recordsResult.error;

  return {
    from,
    to,
    certification_display_start_date: CERTIFICATION_DISPLAY_START_DATE,
    challenge_start_date: CHALLENGE_START_DATE,
    challenge_end_date: CHALLENGE_END_DATE,
    generated_at: new Date().toISOString(),
    participants: participantsResult.data || [],
    records: recordsResult.data || [],
  };
}

async function getPublicDashboardPayload(cacheKey: string, from: string, to: string, bypassCache: boolean) {
  const now = Date.now();
  if (!bypassCache && publicDashboardCache?.key === cacheKey) {
    if (publicDashboardCache.payload && publicDashboardCache.expiresAt > now) {
      return { payload: publicDashboardCache.payload, cacheStatus: "HIT" };
    }
    if (publicDashboardCache.promise) {
      return { payload: await publicDashboardCache.promise, cacheStatus: "DEDUPED" };
    }
  }

  const promise = buildPublicDashboardPayload(from, to);
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

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    requireSameOrigin: true,
    rateLimit: PUBLIC_DASHBOARD_RATE_LIMIT,
  });
  if (guardResponse) {
    guardResponse.headers.set("Cache-Control", "private, no-store");
    return guardResponse;
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const daysParam = Number(searchParams.get("days") || 30);
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 7), 366) : 30;
  const today = toKstIsoDate();
  const to = today;
  const rangeEnd = new Date(`${to}T00:00:00`);
  const from = scope === "all" ? CHALLENGE_START_DATE : clampToChallengeStart(toIsoDate(addDays(rangeEnd, -(days - 1))));
  const bypassCache = false;
  const cacheKey = `${scope || "range"}:${from}:${to}`;

  try {
    const { payload, cacheStatus } = await getPublicDashboardPayload(cacheKey, from, to, bypassCache);
    return publicDashboardResponse(payload, cacheStatus);
  } catch (error) {
    console.error("Public dashboard error:", error);
    return NextResponse.json({ error: "팀 보드를 불러오지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
