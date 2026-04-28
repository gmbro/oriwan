import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/callback
 *
 * Supabase Google OAuth 콜백 처리.
 * 구글 로그인 완료 후 Supabase가 이 URL로 리다이렉트하며,
 * Authorization Code를 세션으로 교환합니다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 에러 시 랜딩으로
  return NextResponse.redirect(`${origin}?error=auth_failed`);
}
