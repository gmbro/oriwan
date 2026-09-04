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
  const authClient = await createClient();
  const { user, response } = await requireAdminUser(authClient);

  if (response || !user) {
    return {
      ok: false,
      response: response ?? NextResponse.json({ error: "관리자 인증이 필요해요." }, { status: 401 }),
    };
  }

  const service = getServiceClient();
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
