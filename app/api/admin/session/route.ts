import { NextRequest, NextResponse } from "next/server";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/admin";
import { clearAdminSessionCookie, hasValidAdminSession, setAdminSessionCookie } from "@/lib/admin-server";
import { createClient } from "@/lib/supabase/server";

const VERIFY_TYPES = ["email", "magiclink", "signup"] as const;

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    const response = NextResponse.json({ authenticated: false, error: "관리자 이메일 인증이 필요해요." }, { status: user ? 403 : 401 });
    clearAdminSessionCookie(response);
    return response;
  }

  if (!(await hasValidAdminSession(user.id))) {
    const response = NextResponse.json({ authenticated: false, error: "관리자 이메일 인증이 필요해요." }, { status: 401 });
    clearAdminSessionCookie(response);
    return response;
  }

  return NextResponse.json(adminUserResponse(user));
}

export async function PUT() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: ADMIN_EMAIL,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    return NextResponse.json({ error: "인증번호를 보내지 못했어요. Supabase 이메일 OTP 설정을 확인해주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.replace(/\D/g, "") : "";
  if (!token) {
    return NextResponse.json({ error: "메일로 받은 인증번호를 입력해주세요." }, { status: 400 });
  }

  const supabase = await createClient();
  let lastErrorMessage = "";

  for (const type of VERIFY_TYPES) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: ADMIN_EMAIL,
      token,
      type,
    });

    if (!error && data.user && isAdminEmail(data.user.email)) {
      const response = NextResponse.json(adminUserResponse(data.user));
      setAdminSessionCookie(response, data.user.id);
      return response;
    }

    lastErrorMessage = error?.message || lastErrorMessage;
    if (error?.status === 429) break;
  }

  await supabase.auth.signOut();
  const response = NextResponse.json({
    error: lastErrorMessage.includes("rate limit") || lastErrorMessage.includes("429")
      ? "요청이 잠시 몰렸어요. 1분 정도 뒤 새 인증번호로 다시 시도해주세요."
      : "인증번호가 맞지 않거나 만료됐어요. 새 번호를 받아 다시 들어와주세요.",
  }, { status: 401 });
  clearAdminSessionCookie(response);
  return response;
}

export async function DELETE() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  clearAdminSessionCookie(response);
  return response;
}
