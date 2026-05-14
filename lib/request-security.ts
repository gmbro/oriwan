import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BODY_LIMIT_BYTES = 256 * 1024;
const RATE_LIMIT_SWEEP_INTERVAL_MS = 60_000;

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  message?: string;
};

type GuardOptions = {
  maxBodyBytes?: number;
  rateLimit?: RateLimitOptions;
};

type ReadGuardOptions = {
  rateLimit?: RateLimitOptions;
  requireSameOrigin?: boolean;
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();
let lastSweepAt = 0;

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers });
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function allowedOrigins(request: NextRequest) {
  return new Set(
    [
      normalizeOrigin(request.url),
      normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
      normalizeOrigin(process.env.SITE_URL),
      normalizeOrigin(process.env.VERCEL_URL),
    ].filter((origin): origin is string => Boolean(origin))
  );
}

function isAllowedOrigin(request: NextRequest, value: string) {
  const origin = normalizeOrigin(value);
  return Boolean(origin && allowedOrigins(request).has(origin));
}

function sameOriginGuard(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    return isAllowedOrigin(request, origin)
      ? null
      : jsonError("허용되지 않은 출처의 요청입니다. 페이지를 새로고침한 뒤 다시 시도해주세요.", 403);
  }

  const referer = request.headers.get("referer");
  if (referer) {
    return isAllowedOrigin(request, referer)
      ? null
      : jsonError("허용되지 않은 출처의 요청입니다. 페이지를 새로고침한 뒤 다시 시도해주세요.", 403);
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin") return null;

  if (process.env.NODE_ENV !== "production") return null;

  return jsonError("요청 출처를 확인할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.", 403);
}

function bodySizeGuard(request: NextRequest, maxBodyBytes: number) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return null;

  const bodyBytes = Number(contentLength);
  if (!Number.isFinite(bodyBytes) || bodyBytes <= maxBodyBytes) return null;

  return jsonError("요청 용량이 너무 큽니다. 이미지를 줄이거나 나눠서 다시 올려주세요.", 413);
}

function clientAddress(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "unknown";
}

function rateLimitGuard(request: NextRequest, options: RateLimitOptions) {
  const now = Date.now();
  if (now - lastSweepAt > RATE_LIMIT_SWEEP_INTERVAL_MS) {
    lastSweepAt = now;
    for (const [key, bucket] of rateBuckets.entries()) {
      if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
  }

  const key = `${options.key}:${clientAddress(request)}`;
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= options.limit) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return jsonError(options.message || "요청이 잠시 몰렸어요. 조금 뒤 다시 시도해주세요.", 429, {
    "Retry-After": String(retryAfterSeconds),
  });
}

export function guardMutationRequest(request: NextRequest, options: GuardOptions = {}) {
  return (
    sameOriginGuard(request) ||
    bodySizeGuard(request, options.maxBodyBytes ?? DEFAULT_BODY_LIMIT_BYTES) ||
    (options.rateLimit ? rateLimitGuard(request, options.rateLimit) : null)
  );
}

export function guardReadRequest(request: NextRequest, options: ReadGuardOptions = {}) {
  return (
    (options.requireSameOrigin ? sameOriginGuard(request) : null) ||
    (options.rateLimit ? rateLimitGuard(request, options.rateLimit) : null)
  );
}
