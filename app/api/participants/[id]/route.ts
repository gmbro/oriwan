import { NextRequest, NextResponse } from "next/server";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { guardMutationRequest } from "@/lib/request-security";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import { normalizeContentText } from "@/lib/hello-2027-content";
import { FOURTH_SEASON_KEY } from "@/lib/fourth-season-contract";
import { logServerFailure } from "@/lib/server-error-log";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PARTICIPANT_NAME_LENGTH = 40;
const MAX_PARTICIPANT_INTRO_LENGTH = 320;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guardResponse = guardMutationRequest(request, { maxBodyBytes: 8 * 1024 });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service: supabase } = access;

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "수정할 멤버를 다시 선택해주세요." }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, string | number | boolean | null> = {};

  if (typeof body.name === "string") {
    const name = normalizeContentText(body.name, MAX_PARTICIPANT_NAME_LENGTH);
    if (!name) return NextResponse.json({ error: `멤버 이름은 ${MAX_PARTICIPANT_NAME_LENGTH}자 이내로 입력해주세요.` }, { status: 400 });
    patch.name = name;
  }
  if (typeof body.nickname === "string") {
    const rawNickname = body.nickname.trim();
    const nickname = rawNickname ? normalizeContentText(rawNickname, MAX_PARTICIPANT_INTRO_LENGTH) : null;
    if (rawNickname && !nickname) {
      return NextResponse.json({ error: `자기소개는 ${MAX_PARTICIPANT_INTRO_LENGTH}자 이내의 일반 텍스트로 입력해주세요.` }, { status: 400 });
    }
    patch.nickname = nickname;
  }
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.display_order !== undefined) {
    if (!Number.isInteger(body.display_order) || body.display_order < 0 || body.display_order > 10_000) {
      return NextResponse.json({ error: "노출 순서는 0~10000 사이의 정수로 입력해주세요." }, { status: 400 });
    }
    patch.display_order = body.display_order;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "수정할 멤버 정보가 없어요." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("participants")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("season_key", FOURTH_SEASON_KEY)
    .select("id, name, nickname, active, display_order, created_at, season_key")
    .single();

  if (error) {
    logServerFailure("Participant update", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("4기 멤버 스키마가 아직 준비되지 않았어요."), { status: 503 });
    }
    return NextResponse.json({ error: "멤버 정보를 수정하지 못했어요." }, { status: 500 });
  }

  invalidatePublicDashboardCache();

  return NextResponse.json({ participant: data });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guardResponse = guardMutationRequest(request, { maxBodyBytes: 1_024 });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service: supabase } = access;

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "삭제할 멤버를 다시 선택해주세요." }, { status: 400 });
  }
  const { error } = await supabase
    .from("participants")
    .update({ active: false })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("season_key", FOURTH_SEASON_KEY);

  if (error) {
    logServerFailure("Participant delete", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("4기 멤버 스키마가 아직 준비되지 않았어요."), { status: 503 });
    }
    return NextResponse.json({ error: "멤버를 삭제하지 못했어요." }, { status: 500 });
  }

  invalidatePublicDashboardCache();

  return NextResponse.json({ success: true });
}
