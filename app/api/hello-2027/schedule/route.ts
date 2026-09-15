import { createClient } from "@/lib/supabase/server";
import { publicSeasonEvent } from "@/lib/season-schedule-contract";
import { NextResponse } from "next/server";
import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import { readSeasonEvents } from "@/lib/season-schedule-storage";
export async function GET() {
  try {
    const service = getServiceClient();
    if (!service) throw new Error("Storage unavailable");
    const owner = await findAdminUserId(service);
    if (!owner) throw new Error("Owner unavailable");
    const auth=await createClient();
    const {data}=await auth.auth.getClaims();
    const canViewDetails=Boolean(data?.claims?.sub);
    const events=await readSeasonEvents(service, owner);
    return NextResponse.json({ canViewDetails, items: canViewDetails ? events : events.map(publicSeasonEvent) }, { headers: { "Cache-Control": "private, no-store", Vary:"Cookie" } });
  } catch { return NextResponse.json({ error: "일정을 불러오지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 }); }
}
