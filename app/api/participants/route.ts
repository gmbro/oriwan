import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin-server";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

export async function GET() {
  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  const { data, error } = await supabase
    .from("participants")
    .select("id, name, active, display_order, created_at")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Participants query error:", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("참가자 테이블이 아직 없습니다."), { status: 503 });
    }
    return NextResponse.json({ error: "참가자 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ participants: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "이름이 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("participants")
    .insert({
      user_id: user.id,
      name,
      display_order: typeof body.display_order === "number" ? body.display_order : 0,
      active: true,
    })
    .select("id, name, active, display_order, created_at")
    .single();

  if (error) {
    console.error("Participant save error:", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("참가자 테이블이 아직 없습니다."), { status: 503 });
    }
    return NextResponse.json({ error: "참가자 저장 실패" }, { status: 500 });
  }

  return NextResponse.json({ participant: data });
}
