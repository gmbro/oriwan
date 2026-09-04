import { NextRequest, NextResponse } from "next/server";
import { guardMutationRequest } from "@/lib/request-security";
import { clearAdminSessionCookie } from "@/lib/admin-server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/logout
 * 세션을 정리하고 로그아웃합니다.
 */
export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, { maxBodyBytes: 1024 });
  if (guardResponse) return guardResponse;

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Logout error:", error.message);
    const response = NextResponse.json(
      { error: "로그아웃하지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 502, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } },
    );
    clearAdminSessionCookie(response);
    return response;
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } },
  );
  clearAdminSessionCookie(response);
  return response;
}
