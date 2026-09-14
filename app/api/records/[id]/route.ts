import { broadcastDashboardRefreshFromServer } from "@/lib/dashboard-refresh-server";
import { readCertificationReview, reviewCertification, visibleCertificationNotes, writeCertificationReview } from "@/lib/certification-review";
import { after, NextRequest, NextResponse } from "next/server";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { calculatePaceSeconds } from "@/lib/run-records";
import { guardMutationRequest, readLimitedJson } from "@/lib/request-security";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import {
  FOURTH_PERSONAL_RECORD_DATE_ERROR,
  FOURTH_SEASON_KEY,
  isWithinFourthPersonalRecordWindow,
} from "@/lib/fourth-season-contract";
import { logServerFailure } from "@/lib/server-error-log";

const RECORD_STATUSES = new Set(["certified", "needs_review", "missing", "rejected"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function isUniqueConflictError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guardResponse = guardMutationRequest(request);
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service: supabase } = access;

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "수정할 기록을 다시 선택해주세요." }, { status: 400 });
  }
  const parsedBody = await readLimitedJson(request, 256 * 1024);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const patch: Record<string, string | number | null> = {};

  if (typeof body.participant_id === "string") patch.participant_id = body.participant_id;
  if (typeof body.record_date === "string") patch.record_date = body.record_date;
  if (typeof body.record_date === "string" && !isWithinFourthPersonalRecordWindow(body.record_date)) {
    return NextResponse.json({ error: FOURTH_PERSONAL_RECORD_DATE_ERROR }, { status: 400 });
  }
  if ("distance_km" in body) patch.distance_km = sanitizeNumber(body.distance_km);
  if ("duration_seconds" in body) patch.duration_seconds = sanitizeInteger(body.duration_seconds);
  if ("source_app" in body) {
    if (body.source_app !== null && (typeof body.source_app !== "string" || body.source_app.length > 200)) {
      return NextResponse.json({ error: "앱 이름은 200자 이내로 입력해주세요." }, { status: 400 });
    }
    patch.source_app = body.source_app || null;
  }
  if ("status" in body) {
    const status = sanitizeStatus(body.status);
    if (!status) return NextResponse.json({ error: "기록 상태값을 다시 확인해주세요." }, { status: 400 });
    patch.status = status;
  }
  if ("notes" in body) {
    if (body.notes !== null && (typeof body.notes !== "string" || body.notes.length > 4_000)) {
      return NextResponse.json({ error: "메모는 4,000자 이내로 입력해주세요." }, { status: 400 });
    }
    patch.notes = body.notes || null;
  }

  if (typeof patch.participant_id === "string") {
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id")
      .eq("id", patch.participant_id)
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
  }

  const distanceProvided = "distance_km" in body;
  const durationProvided = "duration_seconds" in body;
  const distanceKm = distanceProvided ? sanitizeNumber(body.distance_km) : null;
  const durationSeconds = durationProvided ? sanitizeInteger(body.duration_seconds) : null;
  if ("pace_seconds_per_km" in body) {
    patch.pace_seconds_per_km = sanitizeInteger(body.pace_seconds_per_km);
  } else if (distanceProvided || durationProvided) {
    patch.pace_seconds_per_km = calculatePaceSeconds(distanceKm, durationSeconds);
  }

  const { data: existing, error: readError } = await supabase.from("daily_run_records")
    .select("id, status, participant_id, record_date, image_url, notes, distance_km, duration_seconds")
    .eq("id", id).eq("user_id", user.id).eq("season_key", FOURTH_SEASON_KEY).maybeSingle();
  if (readError) return NextResponse.json({ error: "현재 기록을 확인하지 못했어요." }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "기록을 찾을 수 없어요." }, { status: 404 });
  const identityChanged = (typeof patch.record_date === "string" && patch.record_date !== existing.record_date)
    || (typeof patch.participant_id === "string" && patch.participant_id !== existing.participant_id);
  const storedReview = readCertificationReview(existing.notes);
  const humanNotes = "notes" in patch ? visibleCertificationNotes(patch.notes as string | null) : visibleCertificationNotes(existing.notes);
  // Saving a complete record is sufficient; no separate review workflow.
  const participantId = typeof patch.participant_id === "string" ? patch.participant_id : existing.participant_id;
  const distance = distanceProvided ? distanceKm : existing.distance_km;
  const duration = durationProvided ? durationSeconds : existing.duration_seconds;
  if (!patch.status || patch.status === "needs_review" || patch.status === "certified") {
    if (participantId && ((distance && distance > 0) || (duration && duration > 0))) patch.status = "certified";
  }
  if (storedReview) patch.notes = writeCertificationReview(humanNotes, storedReview);
  else if ("notes" in patch) patch.notes = humanNotes || null;
  let update = supabase.from("daily_run_records").update(patch)
    .eq("id", id).eq("user_id", user.id).eq("season_key", FOURTH_SEASON_KEY);
  // A concurrent re-upload/edit must not approve an image the admin never saw.
  for (const key of ["status", "record_date", "participant_id", "image_url", "notes", "distance_km", "duration_seconds"] as const) {
    update = existing[key] === null ? update.is(key, null) : update.eq(key, existing[key]);
  }
  const { data: updated, error } = await update.select("id").maybeSingle();

  if (error) {
    logServerFailure("Record update", error);
    if (isUniqueConflictError(error)) {
      return NextResponse.json({ error: "이미 그 멤버의 같은 날짜 기록이 있어요. 기존 기록을 먼저 확인해주세요." }, { status: 409 });
    }
    return NextResponse.json({ error: "러닝 기록을 수정하지 못했어요." }, { status: 500 });
  }

  if (!updated) return NextResponse.json({ error: "다른 작업에서 기록이 변경됐어요. 새로고침 후 다시 확인해주세요." }, { status: 409 });
  invalidatePublicDashboardCache();
  after(() => broadcastDashboardRefreshFromServer(supabase));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guardResponse = guardMutationRequest(request);
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service: supabase } = access;

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "삭제할 기록을 다시 선택해주세요." }, { status: 400 });
  }
  const { error } = await supabase
    .from("daily_run_records")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("season_key", FOURTH_SEASON_KEY);

  if (error) {
    logServerFailure("Record delete", error);
    return NextResponse.json({ error: "러닝 기록을 삭제하지 못했어요." }, { status: 500 });
  }

  invalidatePublicDashboardCache();
  after(() => broadcastDashboardRefreshFromServer(supabase));

  return NextResponse.json({ success: true });
}
