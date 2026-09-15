import { NextRequest, NextResponse } from "next/server";
import { createAdminAuthClient } from "@/lib/admin-auth-client";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/admin";
import { clearAdminSessionCookie, hasValidAdminSession, setAdminSessionCookie } from "@/lib/admin-server";
import { guardMutationRequest, readLimitedJson } from "@/lib/request-security";
import { logServerFailure } from "@/lib/server-error-log";
import { createClient } from "@/lib/supabase/server";

const VERIFY_TYPES = ["email", "magiclink", "signup"] as const;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

async function getConfiguredAuthClient(allowLegacy = false) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  try {
    if(allowLegacy)return await createAdminAuthClient();
    return await createClient({ cookieName: "twtt-admin-auth", requireCookieWrites: true });
  } catch (error) {
    logServerFailure("Admin session client", error);
    return null;
  }
}

function authUnavailableResponse() {
  const response = NextResponse.json(
    { authenticated: false, error: "운영 서버의 Supabase 인증 환경변수를 먼저 설정해주세요." },
    { status: 503, headers: PRIVATE_HEADERS },
  );
  return response;
}

function adminUserResponse(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  return {
    authenticated: true,
    user: {
      name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "운영자",
      avatar: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : "",
      email: user.email || ADMIN_EMAIL,
    },
  };
}

export async function GET() {
  const supabase = await getConfiguredAuthClient(true);
  if (!supabase) return authUnavailableResponse();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  if (error) return NextResponse.json({authenticated:false,error:"로그인 상태를 확인하지 못했어요. 다시 시도해주세요."},{status:503,headers:PRIVATE_HEADERS});
  if (!claims || !isAdminEmail(claims.email)) {
    const response = NextResponse.json({ authenticated: false, error: "관리자 이메일 인증이 필요해요." }, { status: claims ? 403 : 401 });
    return response;
  }

  if (!(await hasValidAdminSession(claims.sub))) {
    const response = NextResponse.json({ authenticated: false, error: "관리자 이메일 인증이 필요해요." }, { status: 401 });
    return response;
  }

  const response = NextResponse.json(adminUserResponse({
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    user_metadata: claims.user_metadata || {},
  }), { headers: PRIVATE_HEADERS });
  setAdminSessionCookie(response, claims.sub);
  return response;
}

export async function PUT(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 1024,
    rateLimit: {
      key: "admin-session-otp",
      limit: 3,
      windowMs: 60_000,
      message: "인증번호 요청이 잠시 몰렸어요. 1분 뒤 다시 시도해주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  const supabase = await getConfiguredAuthClient();
  if (!supabase) return authUnavailableResponse();
  const { error } = await supabase.auth.signInWithOtp({
    email: ADMIN_EMAIL,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    logServerFailure("Admin OTP send", error);
    const limited = error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit";
    return NextResponse.json({ error: limited ? "이메일 인증번호 발송 한도에 도달했어요. 잠시 후 다시 요청해주세요. 계속 발생하면 운영자의 메일 발송 설정 확인이 필요해요." : "인증번호 메일 발송에 실패했어요. 잠시 후 다시 시도해주세요.", code: limited ? "email_rate_limited" : "email_delivery_failed" }, { status: limited ? 429 : 502, headers: PRIVATE_HEADERS });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 4 * 1024,
    rateLimit: {
      key: "admin-session-verify",
      limit: 8,
      windowMs: 60_000,
      message: "인증번호 확인 요청이 잠시 몰렸어요. 1분 뒤 다시 시도해주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  const parsedBody = await readLimitedJson(request, 4 * 1024);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const token = typeof body.token === "string" ? body.token.replace(/\D/g, "") : "";
  if (!/^\d{6,8}$/.test(token)) {
    return NextResponse.json({ error: "메일로 받은 인증번호를 입력해주세요." }, { status: 400 });
  }

  const supabase = await getConfiguredAuthClient();
  if (!supabase) return authUnavailableResponse();
  let lastErrorMessage = "";

  for (const type of VERIFY_TYPES) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: ADMIN_EMAIL,
      token,
      type,
    });

    if (!error && data.user && isAdminEmail(data.user.email)) {
      const response = NextResponse.json(adminUserResponse(data.user));
      if (!setAdminSessionCookie(response, data.user.id)) {
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.json({ error: "ADMIN_SESSION_SECRET 환경변수를 먼저 설정해주세요." }, { status: 503 });
      }
      return response;
    }

    lastErrorMessage = error?.message || lastErrorMessage;
    if (error?.status === 429) break;
  }

  const response = NextResponse.json({
    error: lastErrorMessage.includes("rate limit") || lastErrorMessage.includes("429")
      ? "요청이 잠시 몰렸어요. 1분 정도 뒤 새 인증번호로 다시 시도해주세요."
      : "인증번호가 맞지 않거나 만료됐어요. 새 번호를 받아 다시 들어와주세요.",
  }, { status: 401 });
  return response;
}

export async function DELETE(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, { maxBodyBytes: 1024 });
  if (guardResponse) return guardResponse;

  const supabase = await getConfiguredAuthClient(true);
  if (!supabase) return authUnavailableResponse();
  await supabase.auth.signOut({ scope: "local" });

  const response = NextResponse.json({ ok: true });
  clearAdminSessionCookie(response);
  return response;
}
