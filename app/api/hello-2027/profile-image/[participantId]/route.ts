import { NextRequest } from "next/server";

import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import { PUBLIC_FOURTH_PARTICIPANT_ORDER_FILTER } from "@/lib/fourth-participant-visibility";
import { FOURTH_SEASON_KEY } from "@/lib/fourth-season-contract";
import {
  getPublicHello2027ProfileImagePath,
  HELLO_2027_PROFILE_IMAGE_BUCKET,
  MAX_HELLO_2027_PROFILE_IMAGE_BYTES,
} from "@/lib/hello-2027-profile-image-storage";
import { guardReadRequest } from "@/lib/request-security";

export const runtime = "nodejs";

const PUBLIC_IMAGE_HEADERS = {
  // A member can remove the image at any time; do not leave an old public copy
  // in a browser or edge cache after the private object is deleted.
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};

function emptyError(status: number) {
  return new Response(null, {
    status,
    headers: { ...PUBLIC_IMAGE_HEADERS, "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store" },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> },
) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: { key: "hello-2027-profile-image", limit: 600, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const { participantId } = await context.params;
  const path = getPublicHello2027ProfileImagePath(participantId);
  if (!path) return emptyError(404);

  let service;
  try {
    service = getServiceClient();
  } catch {
    service = null;
  }
  if (!service) return emptyError(503);

  const adminUserId = await findAdminUserId(service).catch(() => null);
  if (!adminUserId) return emptyError(404);
  const { data: participant, error: participantError } = await service
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("user_id", adminUserId)
    .eq("season_key", FOURTH_SEASON_KEY)
    .eq("active", true)
    .or(PUBLIC_FOURTH_PARTICIPANT_ORDER_FILTER)
    .maybeSingle();
  if (participantError || !participant) return emptyError(404);

  const { data, error } = await service.storage.from(HELLO_2027_PROFILE_IMAGE_BUCKET).download(path);
  if (error || !data || data.size <= 0 || data.size > MAX_HELLO_2027_PROFILE_IMAGE_BYTES) {
    return emptyError(404);
  }

  return new Response(data, {
    status: 200,
    headers: {
      ...PUBLIC_IMAGE_HEADERS,
      "Content-Length": String(data.size),
      "Content-Type": "image/webp",
    },
  });
}
