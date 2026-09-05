import { NextRequest, NextResponse } from "next/server";

import { getServiceClient } from "@/lib/admin-data";
import {
  FOURTH_PERSONAL_RECORD_START_DATE,
  FOURTH_SEASON_END_DATE,
  FOURTH_SEASON_KEY,
} from "@/lib/fourth-season-contract";
import {
  buildPersonalRecordsPayload,
  type PersonalRunRecordInput,
  type PersonalRunRecordStatus,
} from "@/lib/personal-records";
import { getKakaoDisplayName } from "@/lib/kakao-display-name";
import { ensureParticipantAccount } from "@/lib/participant-account-server";
import { guardReadRequest } from "@/lib/request-security";
import {
  calculatePaceSeconds,
  getCertificationCreditMetrics,
  isRecoveryCertificationRecord,
  toKstIsoDate,
} from "@/lib/run-records";
import { logServerFailure } from "@/lib/server-error-log";
import { createClient } from "@/lib/supabase/server";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};
const RECORD_STATUSES = new Set<PersonalRunRecordStatus>([
  "certified",
  "needs_review",
  "missing",
  "rejected",
]);

type PersonalRecordRow = {
  id: string;
  record_date: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  pace_seconds_per_km: number | null;
  source_app: string | null;
  raw_extracted_text: string | null;
  status: string | null;
  notes: string | null;
};

function privateJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}

function hasKakaoIdentity(user: {
  app_metadata?: Record<string, unknown>;
  identities?: Array<{ provider?: string }>;
}) {
  return user.app_metadata?.provider === "kakao"
    || Boolean(user.identities?.some((identity) => identity.provider === "kakao"));
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function toPersonalRecord(row: PersonalRecordRow): PersonalRunRecordInput | null {
  const date = typeof row.record_date === "string" ? row.record_date : "";
  const status = typeof row.status === "string" && RECORD_STATUSES.has(row.status as PersonalRunRecordStatus)
    ? row.status as PersonalRunRecordStatus
    : null;
  if (!row.id || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !status) return null;

  const isRecovery = isRecoveryCertificationRecord(row);
  const credit = getCertificationCreditMetrics(row);
  const distanceKm = cleanNumber(credit.distanceKm);
  const durationSeconds = cleanNumber(credit.durationSeconds);
  const storedPace = cleanNumber(row.pace_seconds_per_km);

  return {
    id: row.id,
    date,
    status,
    distanceKm,
    durationSeconds: durationSeconds === null ? null : Math.round(durationSeconds),
    paceSecondsPerKm: isRecovery
      ? null
      : storedPace === null
        ? calculatePaceSeconds(distanceKm, durationSeconds)
        : Math.round(storedPace),
    isRecovery,
  };
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: { key: "personal-fourth-records", limit: 90, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return privateJson({ error: "카카오 로그인 서버 설정이 아직 준비되지 않았어요." }, 503);
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !hasKakaoIdentity(user)) {
    return privateJson({ error: "카카오 로그인이 필요해요." }, 401);
  }

  const service = getServiceClient();
  if (!service) return privateJson({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, 503);

  try {
    const connection = await ensureParticipantAccount(service, user.id, getKakaoDisplayName(user));
    if (connection.status !== "approved" || !connection.adminUserId || !connection.participant) {
      return privateJson({
        error: connection.message,
        connection_status: connection.status,
      }, connection.status === "setup_required" || connection.status === "admin_missing" ? 503 : 403);
    }

    const { data, error } = await service
      .from("daily_run_records")
      .select("id, record_date, distance_km, duration_seconds, pace_seconds_per_km, source_app, raw_extracted_text, status, notes")
      .eq("user_id", connection.adminUserId)
      .eq("season_key", FOURTH_SEASON_KEY)
      .eq("participant_id", connection.participant.id)
      .gte("record_date", FOURTH_PERSONAL_RECORD_START_DATE)
      .lte("record_date", FOURTH_SEASON_END_DATE)
      .order("record_date", { ascending: false })
      .limit(500);

    if (error) {
      if (isMissingTableError(error)) {
        return privateJson(missingSchemaResponse("개인 기록 저장소가 아직 준비되지 않았어요."), 503);
      }
      throw error;
    }

    const records = ((data || []) as PersonalRecordRow[])
      .map(toPersonalRecord)
      .filter((record): record is PersonalRunRecordInput => Boolean(record));
    const payload = buildPersonalRecordsPayload(records, toKstIsoDate());

    return privateJson(payload);
  } catch (error) {
    logServerFailure("Personal fourth records", error);
    return privateJson({ error: "개인 기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }
}

export async function POST() {
  return privateJson({
    error: "인증 기록은 운영자가 어드민에서 등록하고 검수합니다.",
  }, 403);
}
