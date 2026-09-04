import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_DASHBOARD_CACHE_CONTROL } from "@/lib/public-dashboard-data";
import { guardReadRequest } from "@/lib/request-security";
import { thirdSeasonSnapshot } from "@/lib/third-season-snapshot";

const PUBLIC_DASHBOARD_RATE_LIMIT = {
  key: "public-dashboard-read",
  limit: 180,
  windowMs: 60_000,
  message: "대시보드 요청이 잠시 몰렸어요. 조금 뒤 새로고침해주세요.",
};

function publicDashboardResponse(payload: unknown) {
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", PUBLIC_DASHBOARD_CACHE_CONTROL);
  response.headers.set("X-TWTT-Snapshot", "3th");
  return response;
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: PUBLIC_DASHBOARD_RATE_LIMIT,
  });
  if (guardResponse) {
    guardResponse.headers.set("Cache-Control", "private, no-store");
    return guardResponse;
  }

  // The legacy endpoint is intentionally frozen with the public, de-identified
  // 3rd-season archive. It performs no database reads or badge writes.
  return publicDashboardResponse(thirdSeasonSnapshot);
}
