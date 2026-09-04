import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/callback
 *
 * Kakao OAuth 완료 후 요청한 화면으로 이동합니다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";
  const nextPath = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/";

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  let redirectOrigin = origin;
  if (configuredSiteUrl) {
    try {
      redirectOrigin = new URL(/^https?:\/\//i.test(configuredSiteUrl) ? configuredSiteUrl : `https://${configuredSiteUrl}`).origin;
    } catch {
      console.error("Invalid SITE_URL configured for auth callback.");
    }
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, redirectOrigin));
    }
  }

  return NextResponse.redirect(new URL("/?error=auth_failed", redirectOrigin));
}
