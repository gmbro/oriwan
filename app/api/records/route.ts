import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { calculatePaceSeconds } from "@/lib/run-records";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import { guardMutationRequest } from "@/lib/request-security";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import {
  FOURTH_PERSONAL_RECORD_DATE_ERROR,
  FOURTH_SEASON_KEY,
  isWithinFourthPersonalRecordWindow,
} from "@/lib/fourth-season-contract";
import { logServerFailure } from "@/lib/server-error-log";

const RECORD_STATUSES = new Set(["certified", "needs_review", "missing", "rejected"]);
const RECORDS_PAGE_SIZE = 1000;
type RecordsSupabaseClient = SupabaseClient;

function sanitizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sanitizeInteger(value: unknown) {
  const n = sanitizeNumber(value);
  return n === null ? null : Math.round(n);
}

function sanitizeStatus(value: unknown) {
  return typeof value === "string" && RECORD_STATUSES.has(value) ? value : null;
}

function hasPositiveMetric(value: number | null) {
  return Boolean(value && value > 0);
}

async function fetchAdminRecords({
  supabase,
  userId,
  from,
  to,
}: {
  supabase: RecordsSupabaseClient;
  userId: string;
  from: string | null;
  to: string | null;
}) {
  const records: unknown[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("daily_run_records")
      .select(`
        id,
        participant_id,
        record_date,
        distance_km,
        duration_seconds,
        pace_seconds_per_km,
        source_app,
        status,
        confidence_score,
        image_url,
        raw_extracted_text,
        notes,
        created_at,
        participants(id, name)
      `)
      .eq("user_id", userId)
      .eq("season_key", FOURTH_SEASON_KEY);

    if (from) query = query.gte("record_date", from);
    if (to) query = query.lte("record_date", to);

    const { data, error } = await query
      .order("record_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + RECORDS_PAGE_SIZE - 1);
    if (error) return { data: records, error };

    const page = data || [];
    records.push(...page);
    if (page.length < RECORDS_PAGE_SIZE) break;
    offset += RECORDS_PAGE_SIZE;
  }

  return { data: records, error: null };
}

export async function GET(request: NextRequest) {
  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service: supabase } = access;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const { data, error } = await fetchAdminRecords({ supabase, userId: user.id, from, to });

  if (error) {
    logServerFailure("Records query", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("러닝 기록 테이블이 아직 준비되지 않았어요."), { status: 503 });
    }
    return NextResponse.json({ error: "러닝 기록을 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ records: data || [] });
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request);
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service: supabase } = access;

  const body = await request.json().catch(() => ({}));
  const participantId = typeof body.participant_id === "string" ? body.participant_id : null;
  const recordDate = typeof body.record_date === "string" ? body.record_date : null;
  const distanceKm = sanitizeNumber(body.distance_km);
  const durationSeconds = sanitizeInteger(body.duration_seconds);
  const paceSeconds = sanitizeInteger(body.pace_seconds_per_km) ?? calculatePaceSeconds(distanceKm, durationSeconds);

  if (!participantId || !recordDate) {
    return NextResponse.json({ error: "멤버와 날짜를 함께 선택해주세요." }, { status: 400 });
  }
  if (!isWithinFourthPersonalRecordWindow(recordDate)) {
    return NextResponse.json({ error: FOURTH_PERSONAL_RECORD_DATE_ERROR }, { status: 400 });
  }
  if (!hasPositiveMetric(distanceKm) && !hasPositiveMetric(durationSeconds)) {
    return NextResponse.json({ error: "거리 또는 시간 중 하나는 입력해주세요." }, { status: 400 });
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("user_id", user.id)
    .eq("season_key", FOURTH_SEASON_KEY)
    .eq("active", true)
    .maybeSingle();

  if (participantError) {
    logServerFailure("Record participant validation", participantError);
    return NextResponse.json({ error: "멤버 정보를 확인하지 못했어요." }, { status: 500 });
  }
  if (!participant) {
    return NextResponse.json({ error: "활성 멤버를 찾지 못했어요. 멤버 목록을 새로고침해주세요." }, { status: 400 });
  }

  const statusProvided = Object.hasOwn(body, "status");
  const status = statusProvided ? sanitizeStatus(body.status) : "certified";
  if (!status) {
    return NextResponse.json({ error: "기록 상태값을 다시 확인해주세요." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("daily_run_records")
    .upsert(
      {
        user_id: user.id,
        season_key: FOURTH_SEASON_KEY,
        participant_id: participantId,
        record_date: recordDate,
        distance_km: distanceKm,
        duration_seconds: durationSeconds,
        pace_seconds_per_km: paceSeconds,
        source_app: body.source_app || null,
        status,
        confidence_score: sanitizeNumber(body.confidence_score),
        image_url: body.image_url || null,
        raw_extracted_text: body.raw_extracted_text || null,
        notes: body.notes || null,
      },
      { onConflict: "season_key,user_id,participant_id,record_date" }
    )
    .select("id")
    .single();

  if (error) {
    logServerFailure("Record save", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("러닝 기록 테이블이 아직 준비되지 않았어요."), { status: 503 });
    }
    return NextResponse.json({ error: "러닝 기록을 저장하지 못했어요." }, { status: 500 });
  }

  invalidatePublicDashboardCache();

  return NextResponse.json({ success: true, id: data.id });
}
