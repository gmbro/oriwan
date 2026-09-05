import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CreateClientOptions = {
  requireCookieWrites?: boolean;
};

/**
 * 서버 컴포넌트 및 API Route에서 사용할 Supabase 클라이언트를 생성합니다.
 * 브라우저와 주고받는 세션 쿠키를 Supabase SSR 규칙에 맞춰 관리합니다.
 */
export async function createClient(options: CreateClientOptions = {}) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            if (options.requireCookieWrites) {
              throw Object.assign(new Error("Supabase auth cookie write failed."), {
                cause: error,
                code: "supabase_cookie_write_failed",
              });
            }
            // Server Component에서는 set이 불가능할 수 있습니다. 쿠키 쓰기가
            // 인증의 필수 단계인 Route Handler는 requireCookieWrites를 사용합니다.
          }
        },
      },
    }
  );
}
