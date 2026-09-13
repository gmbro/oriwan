import { NextResponse } from "next/server";
import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import { readSeasonEvents } from "@/lib/season-schedule-storage";
export async function GET() {
  try {
    const service = getServiceClient();
    if (!service) throw new Error("Storage unavailable");
    const owner = await findAdminUserId(service);
    if (!owner) throw new Error("Owner unavailable");
    return NextResponse.json({ items: await readSeasonEvents(service, owner) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "일정을 불러오지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 }); }
}
