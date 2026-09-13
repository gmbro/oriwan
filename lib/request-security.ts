import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BODY_LIMIT_BYTES = 256 * 1024;
const RATE_LIMIT_SWEEP_INTERVAL_MS = 60_000;
const MAX_RATE_BUCKETS = 10_000;

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
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "private, no-store");
  return NextResponse.json({ error }, { status, headers: responseHeaders });
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
    // Keep an untrusted stream of distinct addresses from growing the map
    // without bound. This is a per-instance safety net, not a durable quota.
    if (!bucket && rateBuckets.size >= MAX_RATE_BUCKETS) {
      return jsonError("요청이 잠시 몰렸어요. 조금 뒤 다시 시도해주세요.", 429, { "Retry-After": "60" });
    }
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

/**
 * Reads request data through a hard streaming limit. Content-Length is only
 * an early rejection hint and may be omitted on chunked/HTTP2 requests.
 */
async function readLimitedBytes(request: NextRequest, maxBodyBytes: number) {
  if (!request.body) {
    return { ok: false as const, status: 400 as const, error: "요청 내용을 확인해주세요." };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBodyBytes) {
        await reader.cancel();
        return {
          ok: false as const,
          status: 413 as const,
          error: "요청 용량이 너무 커요. 내용을 줄여 다시 시도해주세요.",
        };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false as const, status: 400 as const, error: "요청을 읽지 못했어요." };
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return { ok: true as const, value: body };
}

/** Enforce the limit while reading, including requests without Content-Length. */
export async function readLimitedText(request: NextRequest, maxBodyBytes: number) {
  const result = await readLimitedBytes(request, maxBodyBytes);
  if (!result.ok) return result;
  return { ok: true as const, value: new TextDecoder().decode(result.value) };
}

export async function readLimitedJson(request: NextRequest, maxBodyBytes = DEFAULT_BODY_LIMIT_BYTES) {
  const result = await readLimitedText(request, maxBodyBytes);
  if (!result.ok) return { ok: false as const, response: jsonError(result.error, result.status) };
  try {
    const value: unknown = JSON.parse(result.value);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object_required");
    return { ok: true as const, value: value as Record<string, unknown> };
  } catch {
    return { ok: false as const, response: jsonError("입력 내용을 확인해주세요.", 400) };
  }
}

export async function readLimitedFormData(request: NextRequest, maxBodyBytes: number) {
  const result = await readLimitedBytes(request, maxBodyBytes);
  if (!result.ok) return { ok: false as const, response: jsonError(result.error, result.status) };
  try {
    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: result.value,
    });
    return { ok: true as const, formData: await boundedRequest.formData() };
  } catch {
    return { ok: false as const, response: jsonError("파일 요청 형식을 확인해주세요.", 400) };
  }
}
