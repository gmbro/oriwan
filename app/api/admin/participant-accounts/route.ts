import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/admin-data";
import { requireAdminUser } from "@/lib/admin-server";
import { guardMutationRequest } from "@/lib/request-security";
import { createClient } from "@/lib/supabase/server";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import { getKakaoDisplayName } from "@/lib/kakao-display-name";
import { FOURTH_SEASON_KEY } from "@/lib/participant-account-server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function userProviders(user: { app_metadata?: Record<string, unknown>; identities?: Array<{ provider?: string }> }) {
  return new Set([
    typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "",
    ...(user.identities || []).map((identity) => identity.provider || ""),
  ]);
}

export async function GET() {
  const supabase = await createClient();
  const { response } = await requireAdminUser(supabase);
  if (response) return response;

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "운영 서버 환경변수가 설정되지 않았어요." }, { status: 503 });

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
    console.error("Admin participant account list error:", error);
    return NextResponse.json({ error: "카카오 계정 목록을 불러오지 못했어요." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, { maxBodyBytes: 8 * 1024 });
  if (guardResponse) return guardResponse;

  const supabase = await createClient();
  const { user: adminUser, response } = await requireAdminUser(supabase);
  if (response || !adminUser) return response;

  const body = await request.json().catch(() => ({}));
  const authUserId = typeof body.auth_user_id === "string" ? body.auth_user_id : "";
  const participantId = typeof body.participant_id === "string" ? body.participant_id : "";
  const status = body.status === "revoked" ? "revoked" : "approved";
  const requestedDisplayName = typeof body.display_name_override === "string"
    ? body.display_name_override.trim().replace(/\s+/g, " ").slice(0, 40)
    : "";
  if (!UUID_PATTERN.test(authUserId) || !UUID_PATTERN.test(participantId)) {
    return NextResponse.json({ error: "연결할 카카오 계정과 크루를 다시 선택해주세요." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "운영 서버 환경변수가 설정되지 않았어요." }, { status: 503 });

  try {
    const [{ data: authUserData, error: authUserError }, { data: participant, error: participantError }] = await Promise.all([
      service.auth.admin.getUserById(authUserId),
      service.from("participants").select("id, name").eq("id", participantId).eq("user_id", adminUser.id).eq("active", true).maybeSingle(),
    ]);
    if (authUserError || !authUserData.user || !userProviders(authUserData.user).has("kakao")) {
      return NextResponse.json({ error: "카카오 로그인 계정을 확인하지 못했어요." }, { status: 400 });
    }
    if (participantError) throw participantError;
    if (!participant) return NextResponse.json({ error: "활성 크루를 찾지 못했어요." }, { status: 404 });
    const displayNameOverride = requestedDisplayName || participant.name.trim();
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
      .upsert(payload, { onConflict: "auth_user_id" })
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
    console.error("Admin participant account update error:", error);
    return NextResponse.json({ error: "카카오 계정 연결을 저장하지 못했어요." }, { status: 500 });
  }
}
