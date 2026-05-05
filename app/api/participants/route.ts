import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("participants")
    .select("id, name, nickname, active, display_order, created_at")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Participants query error:", error);
    return NextResponse.json({ error: "참가자 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ participants: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "이름이 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("participants")
    .insert({
      user_id: user.id,
      name,
      nickname: nickname || null,
      display_order: typeof body.display_order === "number" ? body.display_order : 0,
      active: true,
    })
    .select("id, name, nickname, active, display_order, created_at")
    .single();

  if (error) {
    console.error("Participant save error:", error);
    return NextResponse.json({ error: "참가자 저장 실패" }, { status: 500 });
  }

  return NextResponse.json({ participant: data });
}
