import { NextRequest, NextResponse } from "next/server";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { guardMutationRequest } from "@/lib/request-security";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";

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
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, string | number | boolean | null> = {};

  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.nickname === "string") patch.nickname = body.nickname.trim() || null;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.display_order === "number") patch.display_order = body.display_order;

  const { data, error } = await supabase
    .from("participants")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, name, nickname, active, display_order, created_at")
    .single();

  if (error) {
    console.error("Participant update error:", error);
    return NextResponse.json({ error: "멤버 정보를 수정하지 못했어요." }, { status: 500 });
  }

  invalidatePublicDashboardCache();

  return NextResponse.json({ participant: data });
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
  const { error } = await supabase
    .from("participants")
    .update({ active: false })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Participant delete error:", error);
    return NextResponse.json({ error: "멤버를 삭제하지 못했어요." }, { status: 500 });
  }

  invalidatePublicDashboardCache();

  return NextResponse.json({ success: true });
}
