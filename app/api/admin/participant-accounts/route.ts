import { NextRequest, NextResponse } from "next/server";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { normalizeContentText } from "@/lib/hello-2027-content";
import { guardMutationRequest, guardReadRequest } from "@/lib/request-security";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import { getKakaoDisplayName } from "@/lib/kakao-display-name";
import { FOURTH_SEASON_KEY } from "@/lib/participant-account-server";
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
  const { service } = access;

  try {
    const users = [];
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      users.push(...data.users);
      if (data.users.length < 100) break;
    }

    const kakaoUsers = users.filter((user) => userProviders(user).has("kakao"));
    const authUserIds = kakaoUsers.map((user) => user.id);
    const { data: connections, error: connectionError } = authUserIds.length
      ? await service
        .from("participant_accounts")
        .select("auth_user_id, participant_id, status, approved_at, display_name_override, season_key")
        .in("auth_user_id", authUserIds)
        .eq("season_key", FOURTH_SEASON_KEY)
      : { data: [], error: null };

    if (connectionError) {
      if (isMissingTableError(connectionError)) {
        return NextResponse.json(missingSchemaResponse("카카오 계정 승인 테이블이 아직 준비되지 않았어요."), { status: 503 });
      }
      throw connectionError;
    }

    const connectionByUser = new Map((connections || []).map((row) => [row.auth_user_id, row]));
    return NextResponse.json({
      accounts: kakaoUsers.map((user) => {
        const connection = connectionByUser.get(user.id);
        return {
          auth_user_id: user.id,
          display_name: getKakaoDisplayName(user) || "카카오 이름 미제공",
          email: user.email || "",
          created_at: user.created_at,
          participant_id: connection?.participant_id || null,
          status: connection?.status || "unlinked",
          approved_at: connection?.approved_at || null,
          display_name_override: connection?.display_name_override || "",
        };
      }),
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

  const body = await request.json().catch(() => ({}));
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
    return NextResponse.json({ error: "계정 연결 상태는 승인 또는 해제로 선택해주세요." }, { status: 400 });
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
        return NextResponse.json(missingSchemaResponse("카카오 계정 승인 테이블이 아직 준비되지 않았어요."), { status: 503 });
      }
      throw error;
    }

    return NextResponse.json({ account: data });
  } catch (error) {
    logServerFailure("Admin participant account update", error);
    return NextResponse.json({ error: "카카오 계정 연결을 저장하지 못했어요." }, { status: 500 });
  }
}
