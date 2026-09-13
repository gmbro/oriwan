import { after, NextRequest, NextResponse } from "next/server";
import { ownedMember, readMemberJson } from "@/lib/member-upload-server";
import { guardMutationRequest } from "@/lib/request-security";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import { broadcastDashboardRefreshFromServer } from "@/lib/dashboard-refresh-server";
import { participantAccountMutationError } from "@/lib/participant-account-server";
import { resolvePersonalMemberContext } from "@/lib/personal-member-context";
import { logServerFailure } from "@/lib/server-error-log";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function GET() {
  try {
    const context = await resolvePersonalMemberContext();
    if (!context.ok) {
      if (context.reason === "configuration_unavailable") {
        return NextResponse.json({ error: "카카오 로그인 서버 설정이 아직 준비되지 않았어요." }, { status: 503 });
      }
      if (context.reason === "unauthenticated") {
        return NextResponse.json({ error: "카카오 로그인이 필요해요." }, { status: 401 });
      }
      return NextResponse.json({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, { status: 503 });
    }

    const {
      authUserId,
      displayName: kakaoDisplayName,
      connection,
    } = context;
    if (connection.status !== "approved" || !connection.participant) {
      const failure = participantAccountMutationError(connection);
      return NextResponse.json(failure.payload, { status: failure.status, headers: privateHeaders });
    }
    const usesKakaoName = !connection.displayName;
    return NextResponse.json({
      user: { id: authUserId },
      display_name: usesKakaoName ? kakaoDisplayName || connection.displayName : connection.displayName,
      name_source: usesKakaoName ? "kakao" : connection.displayName ? "admin" : null,
      matched_participant: connection.participant,
      connection_status: connection.status,
      connection_message: connection.message,
    }, { headers: privateHeaders });
  } catch (err) {
    logServerFailure("Me profile", err);
    return NextResponse.json({ error: "개인 기능을 불러오지 못했어요." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const guard = guardMutationRequest(request, { maxBodyBytes: 2048, rateLimit: { key: "own-display-name", limit: 10, windowMs: 60_000 } });
  if (guard) return guard;
  const owned = await ownedMember();
  if ("response" in owned) return owned.response;
  const parsed = await readMemberJson(request, 2048);
  if ("response" in parsed) return parsed.response;
  const { body } = parsed;
  const name = typeof body.display_name === "string" ? body.display_name.trim().normalize("NFC").replace(/ +/g, " ") : "";
  if (name.length < 2 || name.length > 40 || /[<>\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/.test(name)) return NextResponse.json({ error: "표시 이름은 2~40자의 일반 텍스트로 입력해주세요." }, { status: 400, headers: privateHeaders });
  const { service, authUserId, connection } = owned.context;
  const oldName = connection.participant!.name;
  try {
    const previousAccount = await service.from("participant_accounts").select("updated_at")
      .eq("auth_user_id", authUserId).eq("participant_id", owned.participantId).eq("season_key", "4th").eq("status", "approved").single();
    if (previousAccount.error || !previousAccount.data) throw new Error("account_unavailable");
    // Conditional updates prevent overwriting a concurrent operator edit.
    // Account and record ownership remain immutable IDs, never a name match.
    const { data: participant, error } = await service.from("participants").update({ name })
      .eq("id", owned.participantId).eq("user_id", owned.adminUserId).eq("season_key", "4th").eq("name", oldName).eq("active", true).select("id").maybeSingle();
    if (error || !participant) throw new Error("name_conflict");
    const { data: account, error: accountError } = await service.from("participant_accounts")
      .update({ display_name_override: name, updated_at: new Date().toISOString() })
      .eq("auth_user_id", authUserId).eq("participant_id", owned.participantId).eq("season_key", "4th").eq("status", "approved").eq("updated_at", previousAccount.data.updated_at).select("participant_id").maybeSingle();
    if (accountError || !account) {
      // Compensate only our exact value; do not roll back someone else's edit.
      await service.from("participants").update({ name: oldName }).eq("id", owned.participantId).eq("user_id", owned.adminUserId).eq("season_key", "4th").eq("name", name);
      throw new Error("account_update_failed");
    }
    invalidatePublicDashboardCache();
    after(() => broadcastDashboardRefreshFromServer(service));
    return NextResponse.json({ display_name: name }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "이름을 저장하지 못했어요. 최신 프로필을 확인하고 다시 시도해주세요." }, { status: 409, headers: privateHeaders });
  }
}
