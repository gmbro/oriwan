import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/4th/:path*",
    "/me/:path*",
    "/admin/:path*",
    "/api/auth/:path*",
    "/api/me/:path*",
    "/api/hello-2027/:path*",
    "/api/admin/:path*",
  ],
};
