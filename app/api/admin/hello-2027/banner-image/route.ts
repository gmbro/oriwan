import { NextRequest, NextResponse } from "next/server";

import { requireAdminDataAccess } from "@/lib/admin-data-access";
import {
  createHello2027BannerImagePath,
  getHello2027BannerImageUrl,
  HELLO_2027_BANNER_STORAGE_BUCKET,
  MAX_HELLO_2027_BANNER_IMAGE_BYTES,
  removeUnusedHello2027BannerImage,
  validateHello2027BannerImage,
} from "@/lib/hello-2027-banner-storage";
import { guardMutationRequest, readLimitedFormData, readLimitedJson } from "@/lib/request-security";

export const runtime = "nodejs";

const MAX_MULTIPART_BODY_BYTES = MAX_HELLO_2027_BANNER_IMAGE_BYTES + 256 * 1024;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
};

function json(payload: object, status = 200) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: MAX_MULTIPART_BODY_BYTES,
    rateLimit: {
      key: "admin-hello-2027-banner-image-upload",
      limit: 20,
      windowMs: 60_000,
      message: "이미지 업로드 요청이 잠시 몰렸어요. 조금 뒤 다시 시도해주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return json({ error: "이미지 파일을 multipart/form-data 형식으로 보내주세요." }, 415);
  }

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;

  const form = await readLimitedFormData(request, MAX_MULTIPART_BODY_BYTES);
  if (!form.ok) return form.response;
  const entry = form.formData.get("file");
  if (!entry || typeof entry === "string") {
    return json({ error: "올릴 이미지 파일을 선택해주세요." }, 400);
  }

  const validation = await validateHello2027BannerImage(entry);
  if (!validation.ok) return json({ error: validation.error }, validation.status);

  const { bytes, contentType: verifiedContentType, extension } = validation.image;
  const path = createHello2027BannerImagePath(user.id, extension);
  const { error } = await service.storage
    .from(HELLO_2027_BANNER_STORAGE_BUCKET)
    .upload(path, bytes, {
      cacheControl: "31536000",
      contentType: verifiedContentType,
      upsert: false,
    });
  if (error) {
    console.error("Admin banner image upload failed.");
    return json({ error: "이미지를 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }

  return json({ imageUrl: getHello2027BannerImageUrl(path, user.id) }, 201);
}

export async function DELETE(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 4 * 1024,
    rateLimit: { key: "admin-hello-2027-banner-image-delete", limit: 40, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;

  const parsed = await readLimitedJson(request, 4 * 1024);
  if (!parsed.ok) return parsed.response;

  try {
    const body: unknown = parsed.value;
    const imageUrl = body && typeof body === "object" && !Array.isArray(body)
      ? (body as { imageUrl?: unknown }).imageUrl
      : null;
    if (typeof imageUrl !== "string") return json({ error: "삭제할 이미지를 다시 선택해주세요." }, 400);
    await removeUnusedHello2027BannerImage(service, user.id, imageUrl);
    return json({ ok: true });
  } catch {
    return json({ error: "삭제할 이미지 정보를 확인해주세요." }, 400);
  }
}
