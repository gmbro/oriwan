import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSafeAuthReturnPath } from "@/lib/auth-return-path";
import {
  KAKAO_AUTH_START_COOKIE,
  KAKAO_AUTH_START_TTL_SECONDS,
  kakaoAuthStartCookieOptions,
} from "@/lib/kakao-auth-flow";
import { guardReadRequest } from "@/lib/request-security";
import { logServerFailure } from "@/lib/server-error-log";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const KAKAO_AUTHORIZATION_ORIGIN = "https://kauth.kakao.com";
const KAKAO_AUTHORIZATION_PATH = "/oauth/authorize";
const KAKAO_PROFILE_SCOPES = "profile_nickname profile_image";
const OAUTH_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

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

function oauthFailure(code: string) {
  return Object.assign(new Error("OAuth redirect validation failed."), { code });
}

function hasOneQueryValue(url: URL, key: string) {
  return url.searchParams.getAll(key).length === 1;
}

function validateSupabaseAuthorizationUrl(
  authorizationUrl: URL,
  supabaseOrigin: string,
  callbackUrl: string,
) {
  const codeChallenge = authorizationUrl.searchParams.get("code_challenge") || "";
  if (
    authorizationUrl.origin !== supabaseOrigin ||
    authorizationUrl.pathname !== "/auth/v1/authorize" ||
    !hasOneQueryValue(authorizationUrl, "provider") ||
    authorizationUrl.searchParams.get("provider") !== "kakao" ||
    !hasOneQueryValue(authorizationUrl, "redirect_to") ||
    authorizationUrl.searchParams.get("redirect_to") !== callbackUrl ||
    !hasOneQueryValue(authorizationUrl, "code_challenge") ||
    !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge) ||
    !hasOneQueryValue(authorizationUrl, "code_challenge_method") ||
    authorizationUrl.searchParams.get("code_challenge_method") !== "s256" ||
    authorizationUrl.username ||
    authorizationUrl.password ||
    authorizationUrl.hash
  ) {
    throw oauthFailure("invalid_supabase_authorize_url");
  }
}

function validatedKakaoAuthorizationUrl(
  location: string,
  supabaseOrigin: string,
) {
  let authorizationUrl: URL;
  try {
    authorizationUrl = new URL(location);
  } catch {
    throw oauthFailure("invalid_kakao_location");
  }

  const expectedCallback = new URL("/auth/v1/callback", supabaseOrigin).toString();
  const clientId = authorizationUrl.searchParams.get("client_id") || "";
  const state = authorizationUrl.searchParams.get("state") || "";

  if (
    authorizationUrl.origin !== KAKAO_AUTHORIZATION_ORIGIN ||
    authorizationUrl.pathname !== KAKAO_AUTHORIZATION_PATH ||
    !hasOneQueryValue(authorizationUrl, "response_type") ||
    authorizationUrl.searchParams.get("response_type") !== "code" ||
    !hasOneQueryValue(authorizationUrl, "redirect_uri") ||
    authorizationUrl.searchParams.get("redirect_uri") !== expectedCallback ||
    !hasOneQueryValue(authorizationUrl, "client_id") ||
    !/^[a-f0-9]{32}$/i.test(clientId) ||
    !hasOneQueryValue(authorizationUrl, "state") ||
    state.length < 16 ||
    state.length > 2048 ||
    authorizationUrl.username ||
    authorizationUrl.password ||
    authorizationUrl.hash
  ) {
    throw oauthFailure("invalid_kakao_authorize_url");
  }

  // Supabase Kakao OAuth currently appends account_email by default. The app does
  // not collect email, so preserve Supabase state/PKCE and narrow only this scope.
  authorizationUrl.searchParams.set("scope", KAKAO_PROFILE_SCOPES);
  return authorizationUrl;
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

  const cookieStore = await cookies();
  if (cookieStore.has(KAKAO_AUTH_START_COOKIE)) {
    return backToEntry(request, "auth_in_progress");
  }

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

    const supabase = await createClient({ requireCookieWrites: true });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: callback.toString(),
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) return backToEntry(request, "auth_failed");

    const supabaseOrigin = new URL(supabaseUrl).origin;
    const authorizationUrl = new URL(data.url);
    validateSupabaseAuthorizationUrl(authorizationUrl, supabaseOrigin, callback.toString());

    const providerResponse = await fetch(authorizationUrl, {
      method: "GET",
      headers: { Accept: "text/html" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    if (!OAUTH_REDIRECT_STATUSES.has(providerResponse.status)) {
      throw oauthFailure("unexpected_supabase_authorize_status");
    }

    const providerLocation = providerResponse.headers.get("location");
    if (!providerLocation) throw oauthFailure("missing_kakao_location");

    const response = authRedirect(validatedKakaoAuthorizationUrl(providerLocation, supabaseOrigin));
    response.cookies.set(KAKAO_AUTH_START_COOKIE, "1", {
      ...kakaoAuthStartCookieOptions(),
      maxAge: KAKAO_AUTH_START_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    logServerFailure("Kakao OAuth start", error);
    return backToEntry(request, "auth_failed");
  }
}
