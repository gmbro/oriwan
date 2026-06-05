import { NextRequest, NextResponse } from "next/server";
import { getPublicDashboardDateRange, getPublicDashboardPayload, PUBLIC_DASHBOARD_CACHE_CONTROL } from "@/lib/public-dashboard-data";
import { guardReadRequest } from "@/lib/request-security";

const PUBLIC_DASHBOARD_RATE_LIMIT = {
  key: "public-dashboard-read",
  limit: 180,
  windowMs: 60_000,
  message: "대시보드 요청이 잠시 몰렸어요. 조금 뒤 새로고침해주세요.",
};

function publicDashboardResponse(payload: unknown, cacheStatus = "MISS") {
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", PUBLIC_DASHBOARD_CACHE_CONTROL);
  response.headers.set("X-Oriwan-Cache", cacheStatus);
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

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const daysParam = Number(searchParams.get("days") || 30);
  const { from, to, cacheKey } = getPublicDashboardDateRange({ scope, daysParam });

  try {
    const { payload, cacheStatus } = await getPublicDashboardPayload(cacheKey, from, to);
    return publicDashboardResponse(payload, cacheStatus);
  } catch (error) {
    console.error("Public dashboard error:", error);
    return NextResponse.json({ error: "팀 보드를 불러오지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
