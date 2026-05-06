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
      response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }),
    };
  }

  if (!isAdminEmail(user.email)) {
    return {
      user: null,
      response: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }),
    };
  }

  return { user, response: null };
}
