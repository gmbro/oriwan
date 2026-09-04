import { NextResponse } from "next/server";
import { getSafeAuthReturnUrl } from "@/lib/auth-return-path";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/callback
 *
 * Kakao OAuth 완료 후 요청한 화면으로 이동합니다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  let redirectOrigin = origin;
  if (!configuredSiteUrl && process.env.NODE_ENV === "production") {
    console.error("SITE_URL is required for the production auth callback.");
    return NextResponse.json(
      { error: "로그인 반환 주소가 아직 준비되지 않았어요." },
      { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
  if (configuredSiteUrl) {
    try {
      redirectOrigin = new URL(/^https?:\/\//i.test(configuredSiteUrl) ? configuredSiteUrl : `https://${configuredSiteUrl}`).origin;
    } catch {
      console.error("Invalid SITE_URL configured for auth callback.");
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "로그인 반환 주소가 올바르지 않아요." },
          { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } },
        );
      }
    }
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        const redirectTarget = getSafeAuthReturnUrl(searchParams.get("next"), redirectOrigin);
        return NextResponse.redirect(redirectTarget, {
          headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
        });
      }
    } catch {
      console.error("Kakao OAuth callback exchange failed.");
    }
  }

  return NextResponse.redirect(new URL("/?error=auth_failed", redirectOrigin), {
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}
