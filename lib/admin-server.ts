import { NextResponse } from "next/server";
import type { JwtPayload } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isAdminEmail } from "@/lib/admin";

type AuthReadable = {
  auth: {
    getClaims: () => Promise<{
      data: { claims: JwtPayload } | null;
      error: unknown;
    }>;
  };
};

export type AdminSessionUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
};

const ADMIN_SESSION_COOKIE = "oriwan_admin_verified";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function getAdminSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) return null;
  if (secret === process.env.SUPABASE_SERVICE_ROLE_KEY || secret === process.env.DAILY_FORTUNE_SECRET) {
    return null;
  }
  return secret;
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
  if (!signature) return false;

  response.cookies.set(ADMIN_SESSION_COOKIE, `${userId}.${expiresAt}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return true;
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
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  if (error || !claims) {
    return {
      user: null,
      response: NextResponse.json({ error: "어드민에 들어가려면 먼저 로그인해주세요." }, { status: 401 }),
    };
  }

  if (!isAdminEmail(claims.email)) {
    return {
      user: null,
      response: NextResponse.json({ error: "지정된 관리자만 들어올 수 있어요." }, { status: 403 }),
    };
  }

  const hasAdminSession = await hasValidAdminSession(claims.sub);
  if (!hasAdminSession) {
    return {
      user: null,
      response: NextResponse.json({ error: "관리자 이메일 인증이 만료됐어요. 다시 인증해주세요." }, { status: 401 }),
    };
  }

  const user: AdminSessionUser = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    user_metadata: claims.user_metadata || {},
  };

  return { user, response: null };
}
