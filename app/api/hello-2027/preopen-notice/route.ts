import { NextRequest, NextResponse } from "next/server";
import { guardMutationRequest } from "@/lib/request-security";
import { toKstIsoDate } from "@/lib/run-records";

const COOKIE_NAME = "twtt_4th_preopen_dismissed";

function secondsUntilNextSeoulDay() {
  const now = Date.now();
  const seoulNow = new Date(now + 9 * 60 * 60 * 1000);
  const nextMidnightUtc = Date.UTC(
    seoulNow.getUTCFullYear(),
    seoulNow.getUTCMonth(),
    seoulNow.getUTCDate() + 1,
  ) - 9 * 60 * 60 * 1000;
  return Math.max(60, Math.ceil((nextMidnightUtc - now) / 1000));
}

export async function GET(request: NextRequest) {
  const dismissed = request.cookies.get(COOKIE_NAME)?.value === toKstIsoDate();
  return NextResponse.json({ dismissed }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, { maxBodyBytes: 1024 });
  if (guardResponse) return guardResponse;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, toKstIsoDate(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: secondsUntilNextSeoulDay(),
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
