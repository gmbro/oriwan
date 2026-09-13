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
    // Public content and image routes do not use the viewer's session. Avoid
    // refreshing auth before every avatar/banner request on the dashboard.
    "/api/hello-2027/viewer",
    "/api/hello-2027/comments/:path*",
    "/api/admin/:path*",
  ],
};
