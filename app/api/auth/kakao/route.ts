import { NextRequest, NextResponse } from "next/server";
import { getSafeAuthReturnPath } from "@/lib/auth-return-path";
import { guardReadRequest } from "@/lib/request-security";
import { logServerFailure } from "@/lib/server-error-log";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function configuredOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (!configured) return process.env.NODE_ENV === "production" ? null : request.nextUrl.origin;

  try {
    const url = new URL(/^https?:\/\//i.test(configured) ? configured : `https://${configured}`);
    return url.origin;
  } catch {
    return null;
  }
}

function backToEntry(request: NextRequest, error: string) {
  const origin = configuredOrigin(request) || request.nextUrl.origin;
  const target = new URL("/", origin);
  target.searchParams.set("error", error);
  return NextResponse.redirect(target, {
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}

function authRedirect(target: URL) {
  return NextResponse.redirect(target, {
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: {
      key: "kakao-oauth-start",
      limit: 20,
      windowMs: 60_000,
      message: "로그인 요청이 잠시 몰렸어요. 잠시 후 다시 시도해주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const siteOrigin = configuredOrigin(request);
  if (!supabaseUrl || !supabaseKey || !siteOrigin) {
    return backToEntry(request, "auth_unavailable");
  }

  try {
    const nextPath = getSafeAuthReturnPath(request.nextUrl.searchParams.get("next"), "/");
    const callback = new URL("/api/auth/callback", siteOrigin);
    callback.searchParams.set("next", nextPath);

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: callback.toString(),
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) return backToEntry(request, "auth_failed");

    const authorizationUrl = new URL(data.url);
    if (authorizationUrl.origin !== new URL(supabaseUrl).origin) {
      console.error("Unexpected Supabase OAuth authorization origin.");
      return backToEntry(request, "auth_failed");
    }

    return authRedirect(authorizationUrl);
  } catch (error) {
    logServerFailure("Kakao OAuth start", error);
    return backToEntry(request, "auth_failed");
  }
}
