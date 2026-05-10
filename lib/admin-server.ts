import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isAdminEmail } from "@/lib/admin";

type AuthReadable = {
  auth: {
    getUser: () => Promise<{ data: { user: User | null } }>;
  };
};

const ADMIN_SESSION_COOKIE = "oriwan_admin_verified";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 2;

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function signAdminSession(userId: string, expiresAt: number) {
  const secret = getAdminSessionSecret();
  if (!secret) return null;

  return createHmac("sha256", secret)
    .update(`${userId}.${expiresAt}`)
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export function setAdminSessionCookie(response: NextResponse, userId: string) {
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
  const signature = signAdminSession(userId, expiresAt);
  if (!signature) return;

  response.cookies.set(ADMIN_SESSION_COOKIE, `${userId}.${expiresAt}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function hasValidAdminSession(userId: string) {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!value) return false;

  const [cookieUserId, expiresAtText, signature] = value.split(".");
  const expiresAt = Number(expiresAtText);
  if (!cookieUserId || !expiresAt || !signature) return false;
  if (cookieUserId !== userId || expiresAt < Date.now()) return false;

  const expectedSignature = signAdminSession(cookieUserId, expiresAt);
  return Boolean(expectedSignature && safeEqual(signature, expectedSignature));
}

export async function requireAdminUser(supabase: AuthReadable) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "어드민에 들어가려면 먼저 로그인해주세요." }, { status: 401 }),
    };
  }

  if (!isAdminEmail(user.email)) {
    return {
      user: null,
      response: NextResponse.json({ error: "지정된 관리자만 들어올 수 있어요." }, { status: 403 }),
    };
  }

  const hasAdminSession = await hasValidAdminSession(user.id);
  if (!hasAdminSession) {
    return {
      user: null,
      response: NextResponse.json({ error: "관리자 이메일 인증이 만료됐어요. 다시 인증해주세요." }, { status: 401 }),
    };
  }

  return { user, response: null };
}
