import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin-server";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import { guardMutationRequest } from "@/lib/request-security";

export async function GET() {
  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  const { data, error } = await supabase
    .from("participants")
    .select("id, name, nickname, active, display_order, created_at")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Participants query error:", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("멤버 테이블이 아직 준비되지 않았어요."), { status: 503 });
    }
    return NextResponse.json({ error: "멤버 목록을 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ participants: data || [] });
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request);
  if (guardResponse) return guardResponse;

  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : null;

  if (!name) {
    return NextResponse.json({ error: "멤버 이름을 입력해주세요." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("participants")
    .insert({
      user_id: user.id,
      name,
      nickname,
      display_order: typeof body.display_order === "number" ? body.display_order : 0,
      active: true,
    })
    .select("id, name, nickname, active, display_order, created_at")
    .single();

  if (error) {
    console.error("Participant save error:", error);
    if (isMissingTableError(error)) {
      return NextResponse.json(missingSchemaResponse("멤버 테이블이 아직 준비되지 않았어요."), { status: 503 });
    }
    return NextResponse.json({ error: "멤버를 저장하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ participant: data });
}
