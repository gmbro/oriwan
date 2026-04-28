import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버 컴포넌트 및 API Route에서 사용할 Supabase 클라이언트를 생성합니다.
 * 쿠키 기반 세션을 안전하게 관리하여, 민감한 토큰이 클라이언트에 노출되지 않도록 합니다.
 */
export async function createClient() {
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
          } catch {
            // Server Component에서 호출되면 set이 불가능하지만, 
            // 미들웨어나 Route Handler에서는 정상 동작합니다.
          }
        },
      },
    }
  );
}
