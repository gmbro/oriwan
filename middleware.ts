import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 미들웨어 (Edge Runtime)
 *
 * 보안 기능:
 * 1. 보호된 라우트(/dashboard, /success) 접근 시 로그인 여부를 확인합니다.
 * 2. 보안 HTTP 헤더를 모든 응답에 추가합니다.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ===== 보안 HTTP 헤더 =====
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  // ===== 보호된 라우트: 인증 확인 =====
  const protectedPaths = ["/dashboard", "/success"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const session = request.cookies.get("oriwan_session");

    if (!session) {
      // 로그인되지 않은 사용자 → 랜딩 페이지로 리다이렉트
      const loginUrl = new URL("/", request.url);
      loginUrl.searchParams.set("error", "login_required");
      return NextResponse.redirect(loginUrl);
    }
  }

  // ===== API 라우트 보안 =====
  if (pathname.startsWith("/api/strava") || pathname.startsWith("/api/ai")) {
    const session = request.cookies.get("oriwan_session");
    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 파일과 Next.js 내부 경로는 제외
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
