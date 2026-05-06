import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin-server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

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
    return NextResponse.json({ error: "참가자 수정 실패" }, { status: 500 });
  }

  return NextResponse.json({ participant: data });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  const { id } = await context.params;
  const { error } = await supabase
    .from("participants")
    .update({ active: false })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Participant delete error:", error);
    return NextResponse.json({ error: "참가자 삭제 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
