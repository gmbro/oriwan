import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { FOURTH_SEASON_KEY } from "@/lib/fourth-season-contract";
import {
  cancelPendingKakaoProfileImageImport,
  markExplicitHello2027ProfileImagePreference,
  MAX_HELLO_2027_PROFILE_IMAGE_BYTES,
  removeHello2027ProfileImage,
  saveHello2027ProfileImage,
  validateHello2027ProfileImage,
} from "@/lib/hello-2027-profile-image-storage";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import { guardMutationRequest, readLimitedFormData, readLimitedJson } from "@/lib/request-security";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

function json(payload: object, status = 200) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}

async function participantBelongsToAdmin(
  service: SupabaseClient,
  adminUserId: string,
  participantId: string,
) {
  const { data, error } = await service
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("user_id", adminUserId)
    .eq("season_key", FOURTH_SEASON_KEY)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function POST(request: NextRequest) {
  const maximumRequestBytes = MAX_HELLO_2027_PROFILE_IMAGE_BYTES + 256 * 1024;
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: maximumRequestBytes,
    rateLimit: { key: "admin-member-profile-image-upload", limit: 30, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("multipart/form-data;")) {
    return json({ error: "프로필 사진을 파일 형식으로 보내주세요." }, 415);
  }
  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;

  const formDataResult = await readLimitedFormData(request, maximumRequestBytes);
  if (!formDataResult.ok) return formDataResult.response;
  const formData = formDataResult.formData;
  const participantIdValue = formData.get("participant_id");
  const participantId = typeof participantIdValue === "string" ? participantIdValue : "";
  const file = formData.get("file");
  if (!UUID_PATTERN.test(participantId)) return json({ error: "사진을 변경할 멤버를 다시 선택해주세요." }, 400);
  if (!file || typeof file === "string") return json({ error: "변경할 사진을 선택해주세요." }, 400);

  try {
    if (!await participantBelongsToAdmin(access.service, access.user.id, participantId)) {
      return json({ error: "활성 크루를 찾지 못했어요." }, 404);
    }
    const validation = await validateHello2027ProfileImage(file);
    if (!validation.ok) return json({ error: validation.error }, validation.status);
    await markExplicitHello2027ProfileImagePreference(access.service, participantId, "custom");
    await cancelPendingKakaoProfileImageImport(access.service, participantId);
    const imageUrl = await saveHello2027ProfileImage(access.service, participantId, validation.bytes);
    invalidatePublicDashboardCache();
    return json({ participant_id: participantId, profile_image_url: imageUrl }, 201);
  } catch {
    return json({ error: "프로필 사진을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 4 * 1024,
    rateLimit: { key: "admin-member-profile-image-delete", limit: 30, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;
  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const parsedBody = await readLimitedJson(request, 4 * 1024);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const participantId = body && typeof body === "object" && typeof body.participant_id === "string"
    ? body.participant_id
    : "";
  if (!UUID_PATTERN.test(participantId)) return json({ error: "사진을 삭제할 멤버를 다시 선택해주세요." }, 400);

  try {
    if (!await participantBelongsToAdmin(access.service, access.user.id, participantId)) {
      return json({ error: "활성 크루를 찾지 못했어요." }, 404);
    }
    await markExplicitHello2027ProfileImagePreference(access.service, participantId, "removed");
    await cancelPendingKakaoProfileImageImport(access.service, participantId);
    await removeHello2027ProfileImage(access.service, participantId);
    invalidatePublicDashboardCache();
    return json({ participant_id: participantId, profile_image_url: null });
  } catch {
    return json({ error: "프로필 사진을 삭제하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }
}
