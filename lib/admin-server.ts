import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";

type AuthReadable = {
  auth: {
    getUser: () => Promise<{ data: { user: User | null } }>;
  };
};

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

  return { user, response: null };
}
