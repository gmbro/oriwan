import { NextRequest, NextResponse } from "next/server";
import { getSafeAuthReturnUrl } from "@/lib/auth-return-path";
import {
  KAKAO_AUTH_RETURN_COOKIE,
  KAKAO_AUTH_START_COOKIE,
  kakaoAuthStartCookieOptions,
} from "@/lib/kakao-auth-flow";
import { createClient } from "@/lib/supabase/server";

function callbackRedirect(target: URL) {
  const response = NextResponse.redirect(target, {
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
  for (const name of [KAKAO_AUTH_START_COOKIE, KAKAO_AUTH_RETURN_COOKIE]) {
    response.cookies.set(name, "", {
      ...kakaoAuthStartCookieOptions(),
      maxAge: 0,
    });
  }
  return response;
}

function callbackConfigurationError(message: string, status: number) {
  const response = NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } },
  );
  for (const name of [KAKAO_AUTH_START_COOKIE, KAKAO_AUTH_RETURN_COOKIE]) {
    response.cookies.set(name, "", {
      ...kakaoAuthStartCookieOptions(),
      maxAge: 0,
    });
  }
  return response;
}

/**
 * GET /api/auth/callback
 *
 * Kakao OAuth 완료 후 요청한 화면으로 이동합니다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Keep compatibility with any authorization started immediately before this
  // deployment, while preferring the fixed-callback return cookie for new flows.
  const requestedReturnPath = request.cookies.get(KAKAO_AUTH_RETURN_COOKIE)?.value
    ?? searchParams.get("next");

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  let redirectOrigin = origin;
  if (!configuredSiteUrl && process.env.NODE_ENV === "production") {
    console.error("SITE_URL is required for the production auth callback.");
    return callbackConfigurationError("로그인 반환 주소가 아직 준비되지 않았어요.", 503);
  }
  if (configuredSiteUrl) {
    try {
      redirectOrigin = new URL(/^https?:\/\//i.test(configuredSiteUrl) ? configuredSiteUrl : `https://${configuredSiteUrl}`).origin;
    } catch {
      console.error("Invalid SITE_URL configured for auth callback.");
      if (process.env.NODE_ENV === "production") {
        return callbackConfigurationError("로그인 반환 주소가 올바르지 않아요.", 503);
      }
    }
  }

  if (code) {
    try {
      const supabase = await createClient({ requireCookieWrites: true });
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        const redirectTarget = getSafeAuthReturnUrl(
          requestedReturnPath,
          redirectOrigin,
          "/4th/dashboard#member-features",
        );
        return callbackRedirect(redirectTarget);
      }
    } catch {
      console.error("Kakao OAuth callback exchange failed.");
    }
  }

  return callbackRedirect(new URL("/4th?error=auth_failed", redirectOrigin));
}
