import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/admin-data";
import { requireAdminUser } from "@/lib/admin-server";
import { createClient } from "@/lib/supabase/server";

type AdminDataAccess =
  | {
      ok: true;
      user: User;
      service: SupabaseClient;
    }
  | {
      ok: false;
      response: NextResponse;
    };

/**
 * Verifies the request's Supabase user and signed OTP admin session before
 * returning the server-only service-role client used for privileged data I/O.
 */
export async function requireAdminDataAccess(): Promise<AdminDataAccess> {
  let authClient: Awaited<ReturnType<typeof createClient>>;
  try {
    authClient = await createClient();
  } catch {
    console.error("Admin data access is unavailable because Supabase auth is not configured.");
    return {
      ok: false,
      response: NextResponse.json(
        { error: "운영 서버의 Supabase 인증 환경변수를 먼저 설정해주세요." },
        {
          status: 503,
          headers: {
            "Cache-Control": "private, no-store",
            "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
            "X-Content-Type-Options": "nosniff",
          },
        }
      ),
    };
  }
  let user: User | null;
  let response: NextResponse | null;
  try {
    ({ user, response } = await requireAdminUser(authClient));
  } catch {
    console.error("Admin authentication is temporarily unavailable.");
    return {
      ok: false,
      response: NextResponse.json(
        { error: "관리자 인증 서비스를 잠시 사용할 수 없어요. 잠시 후 다시 시도해주세요." },
        { status: 503, headers: { "Cache-Control": "private, no-store" } }
      ),
    };
  }

  if (response || !user) {
    return {
      ok: false,
      response: response ?? NextResponse.json({ error: "관리자 인증이 필요해요." }, { status: 401 }),
    };
  }

  let service: SupabaseClient | null;
  try {
    service = getServiceClient();
  } catch {
    service = null;
  }
  if (!service) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "운영 서버의 Supabase service role 환경변수를 먼저 설정해주세요." },
        { status: 503 }
      ),
    };
  }

  return { ok: true, user, service };
}
