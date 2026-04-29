import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/auth/strava/status
 * Strava 연동 상태를 서버사이드에서 확인합니다.
 * httpOnly 쿠키는 document.cookie로 읽을 수 없으므로,
 * 서버 API를 통해 확인합니다.
 */
export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get("oriwan_session")?.value;

  if (!session) {
    return NextResponse.json({ connected: false });
  }

  try {
    const data = JSON.parse(session);
    return NextResponse.json({
      connected: true,
      athlete: data.athlete?.firstname || "",
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
