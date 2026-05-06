import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_EMAIL } from "@/lib/admin";
import { addDays, toIsoDate } from "@/lib/run-records";

type AdminUser = {
  id: string;
  email?: string;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findAdminUserId(supabase: SupabaseClient) {
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;

    const admin = data.users.find(
      (user: AdminUser) => user.email?.toLowerCase() === ADMIN_EMAIL
    );
    if (admin) return admin.id;
    if (data.users.length < 100) break;
    page += 1;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "공개 대시보드 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get("days") || 30);
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 7), 90) : 30;
  const to = toIsoDate(new Date());
  const from = toIsoDate(addDays(new Date(), -(days - 1)));

  try {
    const adminUserId = await findAdminUserId(supabase);
    if (!adminUserId) {
      return NextResponse.json({ error: "관리자 계정을 찾지 못했습니다." }, { status: 404 });
    }

    const [participantsResult, recordsResult] = await Promise.all([
      supabase
        .from("participants")
        .select("id, name, nickname, active, display_order, created_at")
        .eq("user_id", adminUserId)
        .eq("active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("daily_run_records")
        .select(`
          id,
          participant_id,
          record_date,
          distance_km,
          duration_seconds,
          pace_seconds_per_km,
          status,
          participants(id, name, nickname)
        `)
        .eq("user_id", adminUserId)
        .gte("record_date", from)
        .lte("record_date", to)
        .order("record_date", { ascending: false }),
    ]);

    if (participantsResult.error) throw participantsResult.error;
    if (recordsResult.error) throw recordsResult.error;

    return NextResponse.json({
      from,
      to,
      generated_at: new Date().toISOString(),
      participants: participantsResult.data || [],
      records: recordsResult.data || [],
    });
  } catch (error) {
    console.error("Public dashboard error:", error);
    return NextResponse.json({ error: "공개 대시보드 조회 실패" }, { status: 500 });
  }
}
