import { createBrowserClient } from "@supabase/ssr";

/**
 * 클라이언트 컴포넌트(브라우저)에서 사용할 Supabase 클라이언트를 생성합니다.
 * NEXT_PUBLIC_ 접두사가 붙은 공개 키만 사용하여 보안을 유지합니다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
