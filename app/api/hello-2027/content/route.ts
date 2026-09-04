import { NextRequest, NextResponse } from "next/server";

import { getPublicHello2027Content } from "@/lib/hello-2027-content";
import { guardReadRequest } from "@/lib/request-security";

const PUBLIC_HEADERS = {
  // Profile introductions share this response, so do not serve stale data
  // after an operator changes or removes a public introduction.
  "Cache-Control": "public, max-age=0, s-maxage=15, must-revalidate",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: { key: "hello-2027-public-content", limit: 240, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const content = await getPublicHello2027Content();
  return NextResponse.json(content, { headers: PUBLIC_HEADERS });
}
