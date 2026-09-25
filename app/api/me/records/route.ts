import { writeCertificationReview } from "@/lib/certification-review";
import { after, NextRequest, NextResponse } from "next/server";
import { memberUploadRecordValues, MEMBER_UPLOAD_BUCKET, MEMBER_UPLOAD_DRAFT_PATTERN, ownsFreshDraft, validateCertificationDate, memberEvidenceIssues, canSavePersonalRun, memberRunClassification } from "@/lib/member-upload-contract";
import { ownedMember, privateUploadStore, readMemberJson, readUploadDraft, uploadPrefix } from "@/lib/member-upload-server";
import { loadHello2027ProfileImageUrls } from "@/lib/hello-2027-profile-image-storage";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import { broadcastDashboardRefreshFromServer } from "@/lib/dashboard-refresh-server";

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
import { resolvePersonalMemberContext } from "@/lib/personal-member-context";
import { guardMutationRequest, guardReadRequest } from "@/lib/request-security";
import {
  calculatePaceSeconds,
  getCertificationCreditMetrics,
  isRecoveryCertificationRecord,
  toKstIsoDate,
} from "@/lib/run-records";
import { logServerFailure } from "@/lib/server-error-log";
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
  image_url: string | null;
};

function privateJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
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
    isPersonal: row.source_app === "member-personal" && row.status === "needs_review",
    distanceKm,
    durationSeconds: durationSeconds === null ? null : Math.round(durationSeconds),
    paceSecondsPerKm: isRecovery
      ? null
      : storedPace === null
        ? calculatePaceSeconds(distanceKm, durationSeconds)
        : Math.round(storedPace),
    isRecovery,
    hasPrivateImage: Boolean(row.image_url?.startsWith("member-run-uploads/4th/") || row.image_url?.startsWith("run-records/4th/")),
  };
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: { key: "personal-fourth-records", limit: 90, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  try {
    const context = await resolvePersonalMemberContext();
    if (!context.ok) {
      if (context.reason === "configuration_unavailable") {
        return privateJson({ error: "카카오 로그인 서버 설정이 아직 준비되지 않았어요." }, 503);
      }
      if (context.reason === "unauthenticated") {
        return privateJson({ error: "카카오 로그인이 필요해요." }, 401);
      }
      return privateJson({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, 503);
    }

    const { authUserId, displayName: kakaoDisplayName, service, connection } = context;
    if (connection.status !== "approved" || !connection.adminUserId || !connection.participant) {
      return privateJson({
        error: connection.message,
        connection_status: connection.status,
      }, connection.status === "setup_required" || connection.status === "admin_missing" ? 503 : 403);
    }

    const recordParticipantId = connection.participant.id;
    const recordsRequest = (async () => {
      const rows: PersonalRecordRow[] = [];
      for (let offset = 0; ; offset += 500) {
      const {data, error} = await service
      .from("daily_run_records")
      .select("id, record_date, distance_km, duration_seconds, pace_seconds_per_km, source_app, raw_extracted_text, status, notes, image_url")
      .eq("user_id", connection.adminUserId)
      .eq("season_key", FOURTH_SEASON_KEY)
      .eq("participant_id", recordParticipantId)
      .gte("record_date", FOURTH_PERSONAL_RECORD_START_DATE)
      .lte("record_date", FOURTH_SEASON_END_DATE)
      .order("record_date", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + 499);
      if (error) return {data: null, error};
      rows.push(...((data || []) as PersonalRecordRow[]));
      if ((data || []).length < 500) return {data: rows, error: null};
      }
    })();

    const [{ data, error }, profileImages] = await Promise.all([
      recordsRequest,
      loadHello2027ProfileImageUrls(service, [connection.participant.id]),
    ]);

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
    const usesKakaoName = !connection.displayName;

    // The personal page needs both profile and record data. Returning the
    // already-resolved profile here avoids a second auth + account lookup on
    // every login while keeping the existing record payload backward compatible.
    return privateJson({
      ...payload,
      profile: {
        user: { id: authUserId },
        display_name: usesKakaoName ? kakaoDisplayName || connection.displayName : connection.displayName,
        profile_image_url: profileImages[connection.participant.id] ?? null,
        name_source: usesKakaoName ? "kakao" : connection.displayName ? "admin" : null,
        matched_participant: {
          id: connection.participant.id,
          name: connection.participant.name,
        },
        connection_status: connection.status,
        connection_message: connection.message,
      },
    });
  } catch (error) {
    logServerFailure("Personal fourth records", error);
    return privateJson({ error: "개인 기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const guard = guardMutationRequest(request, { maxBodyBytes: 4096, rateLimit: { key: "own-run-submit", limit: 20, windowMs: 60_000 } });
  if (guard) return guard;
  const owned = await ownedMember();
  if ("response" in owned) return owned.response;
  const parsed = await readMemberJson(request);
  if ("response" in parsed) return parsed.response;
  const { body } = parsed;
  if (typeof body.draftId !== "string" || !MEMBER_UPLOAD_DRAFT_PATTERN.test(body.draftId)) return privateJson({ error: "인증샷을 먼저 선택해주세요." }, 400);
  try {
    const { service, authUserId } = owned.context;
    const store = await privateUploadStore(service);
    const prefix = uploadPrefix(authUserId, body.draftId);
    const draft = await readUploadDraft(store, prefix);
    if (!draft || !ownsFreshDraft(draft, owned.participantId)) return privateJson({ error: "인증샷 확인 시간이 지났어요. 사진을 다시 선택해주세요." }, 410);
    const issues = memberEvidenceIssues(draft);
    if (!canSavePersonalRun(draft)) return privateJson({ error: issues.join("\n"), issues }, 422);
    const values = memberUploadRecordValues(draft);
    const selected = validateCertificationDate(body.date ?? values.date, toKstIsoDate());
    if (!selected.ok) return privateJson({ error: selected.error }, 400);
    values.date = selected.date;
    const personal = memberRunClassification(draft, values.date) === "personal";
    if (personal && body.saveAsPersonal !== true) return privateJson({ error: [...issues, "개인 기록으로 저장할까요? 인증일과 보상에는 포함되지 않아요."].join("\n"), issues, personalConfirmationRequired: true }, 422);
    const imagePath = `${MEMBER_UPLOAD_BUCKET}/${prefix}/image.webp`;
    const submissionKey = body.draftId.split("/")[1];
    // Match older uploads too; the DB unique key serializes concurrent retries.
    const {data: previous, error: previousError} = await service.from("daily_run_records")
      .select("id,status,record_date,image_url").eq("user_id",owned.adminUserId)
      .eq("season_key",FOURTH_SEASON_KEY).eq("participant_id",owned.participantId)
      .like("image_url", "%/" + submissionKey + "/image.webp").limit(1).maybeSingle();
    if(previousError) throw previousError;
    if(previous) return privateJson({record:{id:previous.id,status:previous.status,date:previous.record_date},duplicate:true});
    const { data, error } = await service.from("daily_run_records").insert({
      user_id: owned.adminUserId, season_key: FOURTH_SEASON_KEY, participant_id: owned.participantId,
      submission_key: submissionKey, record_date: values.date, distance_km: values.distanceKm, duration_seconds: values.durationSeconds,
      pace_seconds_per_km: calculatePaceSeconds(values.distanceKm, values.durationSeconds),
      source_app: personal ? "member-personal" : "member-upload", status: personal ? "needs_review" : "certified", confidence_score: draft.confidence,
      image_url: imagePath, raw_extracted_text: draft.rawText,
      notes: writeCertificationReview(`개인 사진 업로드 · ${body.date ? "본인 선택 날짜" : "업로드 날짜"} 기준 ${personal ? "개인 기록 저장 (공식 인증 제외)" : "인증 완료"}\nOCR 원본: ${JSON.stringify({ date: draft.date, distanceKm: draft.distanceKm, durationSeconds: draft.durationSeconds, model: draft.model, analysisError: draft.analysisError ?? null, warning: draft.warning })}\n확정 기록: ${JSON.stringify(values)}`, { version: 1, uploadedAt: draft.createdAt, ocrDate: draft.activityDate ?? null, ocrTime: draft.activityTime ?? null }),
    }).select("id, status, record_date").single();
    if (error?.code === "23505") {
      const { data: existing } = await service.from("daily_run_records").select("id, status, image_url, record_date")
        .eq("user_id", owned.adminUserId).eq("season_key", FOURTH_SEASON_KEY).eq("participant_id", owned.participantId).eq("submission_key", submissionKey).maybeSingle();
      if (existing?.image_url?.endsWith(`/${submissionKey}/image.webp`)) return privateJson({ record: { id: existing.id, status: existing.status, date: existing.record_date }, duplicate: true });
      return privateJson({ error: "이미 등록된 사진이에요. 내 기록을 확인해주세요." }, 409);
    }
    if (error) throw error;
    invalidatePublicDashboardCache();
    after(() => broadcastDashboardRefreshFromServer(service));
    return privateJson({ record: { ...data, date: values.date } }, 201);
  } catch { return privateJson({ error: "기록을 제출하지 못했어요. 입력값은 유지되며 다시 제출할 수 있어요." }, 503); }
}
