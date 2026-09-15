import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const refresh = async (name?: string) => {
    const supabase = createServerClient(url, key, {
      cookieOptions: { ...(name ? { name } : {}), maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
          const previous=response.cookies.getAll();
          response=NextResponse.next({request});
          previous.forEach(cookie=>response.cookies.set(cookie));
          cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
        },
      },
    });
    // Temporary network failures must not turn a page request into a logout.
    try { await supabase.auth.getClaims(); } catch { /* retry on the next request */ }
  };
  await refresh();
  if(request.cookies.getAll().some(cookie=>cookie.name.startsWith("twtt-admin-auth"))) await refresh("twtt-admin-auth");
  return response;
}
