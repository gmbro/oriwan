import { NextRequest, NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-server";
import { guardMutationRequest } from "@/lib/request-security";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/logout
 * 세션을 정리하고 로그아웃합니다.
 */
export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, { maxBodyBytes: 1024 });
  if (guardResponse) return guardResponse;

  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  clearAdminSessionCookie(response);

  return response;
}
