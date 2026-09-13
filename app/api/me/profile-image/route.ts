import { NextRequest, NextResponse } from "next/server";

import {
  cancelPendingKakaoProfileImageImport,
  markExplicitHello2027ProfileImagePreference,
  MAX_HELLO_2027_PROFILE_IMAGE_BYTES,
  removeHello2027ProfileImage,
  saveHello2027ProfileImage,
  validateHello2027ProfileImage,
} from "@/lib/hello-2027-profile-image-storage";
import { resolvePersonalMemberContext } from "@/lib/personal-member-context";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import { guardMutationRequest, readLimitedFormData } from "@/lib/request-security";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

function json(payload: object, status = 200) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}

async function resolveOwnedParticipant() {
  const context = await resolvePersonalMemberContext();
  if (!context.ok) {
    return {
      response: json({ error: context.reason === "unauthenticated" ? "카카오 로그인이 필요해요." : "프로필 서버 연결을 확인하지 못했어요." }, context.reason === "unauthenticated" ? 401 : 503),
    };
  }
  if (context.connection.status !== "approved" || !context.connection.participant) {
    return { response: json({ error: "연결된 4기 멤버 프로필을 찾지 못했어요." }, 403) };
  }
  return { context, participantId: context.connection.participant.id };
}

export async function POST(request: NextRequest) {
  const maximumRequestBytes = MAX_HELLO_2027_PROFILE_IMAGE_BYTES + 256 * 1024;
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: maximumRequestBytes,
    rateLimit: { key: "member-profile-image-upload", limit: 10, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("multipart/form-data;")) {
    return json({ error: "프로필 사진을 파일 형식으로 보내주세요." }, 415);
  }
  const owned = await resolveOwnedParticipant();
  if ("response" in owned) return owned.response;

  const formDataResult = await readLimitedFormData(request, maximumRequestBytes);
  if (!formDataResult.ok) return formDataResult.response;
  const formData = formDataResult.formData;
  const file = formData.get("file");
  if (!file || typeof file === "string") return json({ error: "변경할 사진을 선택해주세요." }, 400);
  const validation = await validateHello2027ProfileImage(file);
  if (!validation.ok) return json({ error: validation.error }, validation.status);

  try {
    await markExplicitHello2027ProfileImagePreference(
      owned.context.service,
      owned.participantId,
      "custom",
    );
    await cancelPendingKakaoProfileImageImport(owned.context.service, owned.participantId);
    const imageUrl = await saveHello2027ProfileImage(owned.context.service, owned.participantId, validation.bytes);
    invalidatePublicDashboardCache();
    return json({ profile_image_url: imageUrl }, 201);
  } catch {
    return json({ error: "프로필 사진을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 1024,
    rateLimit: { key: "member-profile-image-delete", limit: 10, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;
  const owned = await resolveOwnedParticipant();
  if ("response" in owned) return owned.response;
  try {
    await markExplicitHello2027ProfileImagePreference(
      owned.context.service,
      owned.participantId,
      "removed",
    );
    await cancelPendingKakaoProfileImageImport(owned.context.service, owned.participantId);
    await removeHello2027ProfileImage(owned.context.service, owned.participantId);
    invalidatePublicDashboardCache();
    return json({ profile_image_url: null });
  } catch {
    return json({ error: "프로필 사진을 삭제하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }
}
