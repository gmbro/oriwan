import { NextRequest, NextResponse } from "next/server";
import { getFourthViewer } from "@/lib/fourth-viewer-server";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import { guardReadRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: {
      key: "hello-2027-viewer-read",
      limit: 120,
      windowMs: 60_000,
    },
  });
  if (guardResponse) {
    guardResponse.headers.set("Cache-Control", privateHeaders["Cache-Control"]);
    guardResponse.headers.set("Vary", privateHeaders.Vary);
    return guardResponse;
  }

  const viewer = await getFourthViewer();
  if (viewer.dashboard_member_changed) invalidatePublicDashboardCache();
  return NextResponse.json(viewer, { headers: privateHeaders });
}
