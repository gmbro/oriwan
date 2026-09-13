import { NextRequest, NextResponse } from "next/server";

import { getHello2027DashboardSnapshot } from "@/lib/hello-2027-dashboard-data";
import { guardReadRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

const SNAPSHOT_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
};

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: { key: "hello-2027-dashboard-snapshot", limit: 120, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  // Every dashboard can receive the same public refresh event. Reuse the
  // tagged projection so one event does not fan out into one full database
  // scan per browser; mutations expire the tag before broadcasting.
  const snapshot = await getHello2027DashboardSnapshot();
  return NextResponse.json(snapshot, { headers: SNAPSHOT_HEADERS });
}
