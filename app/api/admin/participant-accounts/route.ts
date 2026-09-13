import { NextRequest, NextResponse } from "next/server";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { normalizeContentText } from "@/lib/hello-2027-content";
import { guardMutationRequest, guardReadRequest, readLimitedJson } from "@/lib/request-security";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import {
  AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
  LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
} from "@/lib/fourth-participant-visibility";
import { FOURTH_SEASON_KEY } from "@/lib/participant-account-server";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import { logServerFailure } from "@/lib/server-error-log";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function userProviders(user: { app_metadata?: Record<string, unknown>; identities?: Array<{ provider?: string }> }) {
  return new Set([
    typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "",
    ...(user.identities || []).map((identity) => identity.provider || ""),
  ]);
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    requireSameOrigin: true,
    rateLimit: { key: "admin-participant-accounts-read", limit: 60, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user: adminUser, service } = access;

  try {
    const { data: connections, error: connectionError } = await service
      .from("participant_accounts")
      .select(`
        auth_user_id, participant_id, status, display_name_override,
        participant:participants!inner(name, user_id, season_key, active)
      `)
      .eq("season_key", FOURTH_SEASON_KEY)
      .in("status", ["pending", "approved"])
      .eq("participant.user_id", adminUser.id)
      .eq("participant.season_key", FOURTH_SEASON_KEY)
      .eq("participant.active", true);

    if (connectionError) {
      if (isMissingTableError(connectionError)) {
        return NextResponse.json(missingSchemaResponse("카카오 계정 연결 테이블이 아직 준비되지 않았어요."), { status: 503 });
      }
      throw connectionError;
    }

    // The write path already verifies Kakao and stores the approved display
    // name. Reading the crew tab should therefore be one joined DB request,
    // rather than one Auth Admin network call per linked member.
    const accounts = (connections || []).map((connection) => {
      const participant = Array.isArray(connection.participant)
        ? connection.participant[0]
        : connection.participant;
      return {
        auth_user_id: connection.auth_user_id, participant_id: connection.participant_id, status: connection.status,
        display_name: connection.display_name_override?.trim()
          || participant?.name?.trim()
          || "카카오 이름 미제공",
      };
    });

    return NextResponse.json({
      accounts,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    logServerFailure("Admin participant account list", error);
    return NextResponse.json({ error: "카카오 계정 목록을 불러오지 못했어요." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, { maxBodyBytes: 8 * 1024 });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user: adminUser, service } = access;

  const parsedBody = await readLimitedJson(request, 8 * 1024);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const authUserId = typeof body.auth_user_id === "string" ? body.auth_user_id : "";
  const participantId = typeof body.participant_id === "string" ? body.participant_id : "";
  const status = body.status === "approved" || body.status === "revoked"
    ? body.status
    : null;
  const rawDisplayName = typeof body.display_name_override === "string"
    ? body.display_name_override
    : "";
  const requestedDisplayName = rawDisplayName.trim()
    ? normalizeContentText(rawDisplayName, 40)
    : "";
  if (
    rawDisplayName.trim()
    && (!requestedDisplayName || requestedDisplayName.length < 2)
  ) {
    return NextResponse.json({ error: "댓글에 표시할 이름은 2~40자의 일반 텍스트로 입력해주세요." }, { status: 400 });
  }
  if (!status) {
    return NextResponse.json({ error: "계정 연결 상태를 다시 선택해주세요." }, { status: 400 });
  }
  if (!UUID_PATTERN.test(authUserId) || !UUID_PATTERN.test(participantId)) {
    return NextResponse.json({ error: "연결할 카카오 계정과 크루를 다시 선택해주세요." }, { status: 400 });
  }

  try {
    const [{ data: authUserData, error: authUserError }, { data: participant, error: participantError }] = await Promise.all([
      service.auth.admin.getUserById(authUserId),
      service
        .from("participants")
        .select("id, name")
        .eq("id", participantId)
        .eq("user_id", adminUser.id)
        .eq("season_key", FOURTH_SEASON_KEY)
        .eq("active", true)
        .maybeSingle(),
    ]);
    if (authUserError || !authUserData.user || !userProviders(authUserData.user).has("kakao")) {
      return NextResponse.json({ error: "카카오 로그인 계정을 확인하지 못했어요." }, { status: 400 });
    }
    if (participantError) throw participantError;
    if (!participant) return NextResponse.json({ error: "활성 크루를 찾지 못했어요." }, { status: 404 });
    const displayNameOverride = requestedDisplayName || normalizeContentText(participant.name, 40) || "";
    if (status === "approved" && (displayNameOverride.length < 2 || displayNameOverride.length > 40)) {
      return NextResponse.json({ error: "댓글에 표시할 이름은 2~40자로 입력해주세요." }, { status: 400 });
    }

    const payload = {
      participant_id: participantId,
      auth_user_id: authUserId,
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by: adminUser.id,
      display_name_override: displayNameOverride,
      season_key: FOURTH_SEASON_KEY,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await service
      .from("participant_accounts")
      .upsert(payload, { onConflict: "season_key,auth_user_id" })
      .select("auth_user_id, participant_id, status, approved_at, display_name_override, season_key")
      .single();

    if (error?.code === "23505") {
      return NextResponse.json({ error: "선택한 크루는 이미 다른 카카오 계정과 연결돼 있어요." }, { status: 409 });
    }
    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(missingSchemaResponse("카카오 계정 연결 테이블이 아직 준비되지 않았어요."), { status: 503 });
      }
      throw error;
    }

    // Older automatic enrollments used random participant IDs, so visibility
    // cannot be inferred from the current deterministic ID alone. The reserved
    // -1/10000 orders identify only automatic hidden/public rows; operator-
    // curated display orders are intentionally left untouched.
    const currentVisibilityOrder = status === "approved"
      ? LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER
      : AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER;
    const nextVisibilityOrder = status === "approved"
      ? AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER
      : LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER;
    const { error: participantVisibilityError } = await service
      .from("participants")
      .update({ display_order: nextVisibilityOrder })
      .eq("id", participantId)
      .eq("user_id", adminUser.id)
      .eq("season_key", FOURTH_SEASON_KEY)
      .eq("active", true)
      .eq("display_order", currentVisibilityOrder);
    if (participantVisibilityError) throw participantVisibilityError;
    invalidatePublicDashboardCache();

    return NextResponse.json({ account: data });
  } catch (error) {
    logServerFailure("Admin participant account update", error);
    return NextResponse.json({ error: "카카오 계정 연결을 저장하지 못했어요." }, { status: 500 });
  }
}
