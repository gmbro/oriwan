import { NextRequest, NextResponse } from "next/server";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import { guardMutationRequest } from "@/lib/request-security";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import { normalizeContentText } from "@/lib/hello-2027-content";
import { FOURTH_SEASON_KEY } from "@/lib/fourth-season-contract";
import { logServerFailure } from "@/lib/server-error-log";

const MAX_PARTICIPANT_NAME_LENGTH = 40;
const MAX_PARTICIPANT_INTRO_LENGTH = 320;

export async function GET() {
  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service: supabase } = access;

  const { data, error } = await supabase
    .from("participants")
    .select("id, name, nickname, active, display_order, created_at, season_key")
    .eq("user_id", user.id)
    .eq("season_key", FOURTH_SEASON_KEY)
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    logServerFailure("Participants query", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("멤버 테이블이 아직 준비되지 않았어요."), { status: 503 });
    }
    return NextResponse.json({ error: "멤버 목록을 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ participants: data || [] });
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, { maxBodyBytes: 8 * 1024 });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service: supabase } = access;

  const body = await request.json().catch(() => ({}));
  const name = normalizeContentText(body.name, MAX_PARTICIPANT_NAME_LENGTH);
  const rawNickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const nickname = rawNickname ? normalizeContentText(rawNickname, MAX_PARTICIPANT_INTRO_LENGTH) : null;

  if (!name) {
    return NextResponse.json({ error: `멤버 이름은 ${MAX_PARTICIPANT_NAME_LENGTH}자 이내로 입력해주세요.` }, { status: 400 });
  }
  if (rawNickname && !nickname) {
    return NextResponse.json({ error: `자기소개는 ${MAX_PARTICIPANT_INTRO_LENGTH}자 이내의 일반 텍스트로 입력해주세요.` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("participants")
    .insert({
      user_id: user.id,
      season_key: FOURTH_SEASON_KEY,
      name,
      nickname,
      display_order: Number.isInteger(body.display_order) && body.display_order >= 0 && body.display_order <= 10_000
        ? body.display_order
        : 0,
      active: true,
    })
    .select("id, name, nickname, active, display_order, created_at, season_key")
    .single();

  if (error) {
    logServerFailure("Participant save", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("멤버 테이블이 아직 준비되지 않았어요."), { status: 503 });
    }
    return NextResponse.json({ error: "멤버를 저장하지 못했어요." }, { status: 500 });
  }

  invalidatePublicDashboardCache();

  return NextResponse.json({ participant: data });
}
