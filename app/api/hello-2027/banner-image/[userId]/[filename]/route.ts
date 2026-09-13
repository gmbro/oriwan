import { NextRequest } from "next/server";

import { getServiceClient } from "@/lib/admin-data";
import {
  bannerImageContentType,
  getPublicHello2027BannerImagePath,
  HELLO_2027_BANNER_STORAGE_BUCKET,
  MAX_HELLO_2027_BANNER_IMAGE_BYTES,
} from "@/lib/hello-2027-banner-storage";
import { guardReadRequest } from "@/lib/request-security";

export const runtime = "nodejs";

const IMMUTABLE_IMAGE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "CDN-Cache-Control": "public, max-age=31536000, immutable",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};

function emptyError(status: number) {
  return new Response(null, {
    status,
    headers: { ...IMMUTABLE_IMAGE_HEADERS, "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store" },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string; filename: string }> },
) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: { key: "hello-2027-banner-image", limit: 600, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const { userId, filename } = await context.params;
  const path = getPublicHello2027BannerImagePath(userId, filename);
  const contentType = path ? bannerImageContentType(path) : null;
  if (!path || !contentType) return emptyError(404);

  let service;
  try {
    service = getServiceClient();
  } catch {
    service = null;
  }
  if (!service) return emptyError(503);

  const { data, error } = await service.storage.from(HELLO_2027_BANNER_STORAGE_BUCKET).download(path);
  if (error || !data || data.size <= 0 || data.size > MAX_HELLO_2027_BANNER_IMAGE_BYTES) {
    return emptyError(error ? 404 : 415);
  }

  return new Response(data, {
    status: 200,
    headers: {
      ...IMMUTABLE_IMAGE_HEADERS,
      "Content-Length": String(data.size),
      "Content-Type": contentType,
    },
  });
}
