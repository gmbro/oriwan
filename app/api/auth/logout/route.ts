import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * POST /api/auth/logout
 *
 * 세션 쿠키를 삭제하여 로그아웃합니다.
 */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("oriwan_session");
  cookieStore.delete("oriwan_user");

  return NextResponse.json({ success: true });
}
