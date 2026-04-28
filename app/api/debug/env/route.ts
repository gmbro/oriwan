import { NextResponse } from "next/server";

/**
 * GET /api/debug/env
 * 환경변수 존재 여부만 확인 (값은 노출하지 않음)
 */
export async function GET() {
  return NextResponse.json({
    STRAVA_CLIENT_ID: !!process.env.STRAVA_CLIENT_ID,
    STRAVA_CLIENT_SECRET: !!process.env.STRAVA_CLIENT_SECRET,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    strava_id_value: process.env.STRAVA_CLIENT_ID ? `${process.env.STRAVA_CLIENT_ID.substring(0, 3)}***` : "NOT_SET",
  });
}
