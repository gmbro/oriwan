import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { FOURTH_SEASON_KEY } from "@/lib/fourth-season-contract";

export const HELLO_2027_PROFILE_IMAGE_BUCKET = "photos";
export const HELLO_2027_PROFILE_IMAGE_ROUTE = "/api/hello-2027/profile-image";
export const MAX_HELLO_2027_PROFILE_IMAGE_BYTES = 4 * 1024 * 1024;

const MAX_REMOTE_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_PROFILE_IMAGE_INPUT_PIXELS = 16_000_000;
const PROFILE_IMAGE_EDGE = 512;
const PROFILE_IMAGE_PREFIX = `hello-2027/profile-images/${FOURTH_SEASON_KEY}`;
const PROFILE_IMAGE_IMPORT_PENDING_PREFIX = `hello-2027/profile-image-import-pending/${FOURTH_SEASON_KEY}`;
const PROFILE_IMAGE_EXPLICIT_PREFERENCE_PREFIX = `hello-2027/profile-image-explicit/${FOURTH_SEASON_KEY}`;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILE_IMAGE_FILE_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.webp$/i;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProfileImageValidation =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; error: string; status: 400 | 413 | 415 };

function hasPrefix(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function detectImageType(bytes: Uint8Array) {
  if (bytes.length >= 3 && hasPrefix(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 8 && hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (
    bytes.length >= 12
    && hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

async function normalizeProfileImage(
  bytes: Uint8Array,
  declaredType: string,
  maximumBytes: number,
): Promise<ProfileImageValidation> {
  if (!bytes.byteLength) return { ok: false, error: "내용이 없는 이미지는 올릴 수 없어요.", status: 400 };
  if (bytes.byteLength > maximumBytes) return { ok: false, error: "프로필 사진은 4MB 이하로 올려주세요.", status: 413 };
  const detectedType = detectImageType(bytes);
  if (!detectedType || detectedType !== declaredType || !ACCEPTED_IMAGE_TYPES.has(declaredType)) {
    return { ok: false, error: "JPG, PNG, WebP 이미지인지 확인해주세요.", status: 415 };
  }

  try {
    const { default: sharp } = await import("sharp");
    const decoder = sharp(bytes, {
      failOn: "warning",
      limitInputPixels: MAX_PROFILE_IMAGE_INPUT_PIXELS,
      sequentialRead: true,
    });
    const metadata = await decoder.metadata();
    if (
      !metadata.width
      || !metadata.height
      || metadata.width * metadata.height > MAX_PROFILE_IMAGE_INPUT_PIXELS
      || (metadata.pages || 1) > 1
    ) {
      return { ok: false, error: "프로필 사진은 1,600만 화소 이하의 정지 이미지를 사용해주세요.", status: 413 };
    }
    const output = await decoder
      .rotate()
      .resize(PROFILE_IMAGE_EDGE, PROFILE_IMAGE_EDGE, {
        fit: "cover",
        position: "attention",
        withoutEnlargement: false,
      })
      .webp({ quality: 82, effort: 5 })
      .toBuffer();
    if (!output.byteLength || output.byteLength > MAX_HELLO_2027_PROFILE_IMAGE_BYTES) {
      return { ok: false, error: "변환된 프로필 사진의 용량이 너무 커요.", status: 413 };
    }
    // Re-encoding verifies the image and strips EXIF/GPS metadata.
    return { ok: true, bytes: new Uint8Array(output) };
  } catch {
    return { ok: false, error: "손상되지 않은 JPG, PNG, WebP 이미지인지 확인해주세요.", status: 415 };
  }
}

export async function validateHello2027ProfileImage(file: File): Promise<ProfileImageValidation> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: "JPG, PNG, WebP 이미지만 올릴 수 있어요.", status: 415 };
  }
  if (file.size > MAX_HELLO_2027_PROFILE_IMAGE_BYTES) {
    return { ok: false, error: "프로필 사진은 4MB 이하로 올려주세요.", status: 413 };
  }
  try {
    return normalizeProfileImage(
      new Uint8Array(await file.arrayBuffer()),
      file.type,
      MAX_HELLO_2027_PROFILE_IMAGE_BYTES,
    );
  } catch {
    return { ok: false, error: "프로필 사진을 읽지 못했어요. 다시 선택해주세요.", status: 400 };
  }
}

function profileImagePath(participantId: string) {
  if (!UUID_PATTERN.test(participantId)) throw new Error("Invalid participant profile image id.");
  return `${PROFILE_IMAGE_PREFIX}/${participantId}.webp`;
}

function profileImageImportPendingPath(participantId: string) {
  if (!UUID_PATTERN.test(participantId)) throw new Error("Invalid participant profile image id.");
  return `${PROFILE_IMAGE_IMPORT_PENDING_PREFIX}/${participantId}.pending`;
}

function profileImageExplicitPreferencePath(participantId: string) {
  if (!UUID_PATTERN.test(participantId)) throw new Error("Invalid participant profile image id.");
  return `${PROFILE_IMAGE_EXPLICIT_PREFERENCE_PREFIX}/${participantId}.preference`;
}

export function getPublicHello2027ProfileImagePath(participantId: unknown) {
  return typeof participantId === "string" && UUID_PATTERN.test(participantId)
    ? profileImagePath(participantId)
    : null;
}

export function getHello2027ProfileImageUrl(participantId: string, version: string | number) {
  if (!UUID_PATTERN.test(participantId)) throw new Error("Invalid participant profile image id.");
  const normalizedVersion = String(version).replace(/[^0-9A-Za-z_-]/g, "").slice(0, 80) || "1";
  return `${HELLO_2027_PROFILE_IMAGE_ROUTE}/${participantId}?v=${normalizedVersion}`;
}

export async function loadHello2027ProfileImageUrls(
  service: SupabaseClient,
  participantIds?: readonly string[],
) {
  const allowedIds = participantIds
    ? new Set(participantIds.filter((id) => UUID_PATTERN.test(id)))
    : null;
  if (allowedIds && !allowedIds.size) return {} as Record<string, string>;

  const { data, error } = await service.storage
    .from(HELLO_2027_PROFILE_IMAGE_BUCKET)
    .list(PROFILE_IMAGE_PREFIX, { limit: 100, sortBy: { column: "name", order: "asc" } });
  if (error) {
    console.error("Public profile image list failed.");
    return {} as Record<string, string>;
  }

  return Object.fromEntries((data || []).flatMap((file) => {
    const match = file.name.match(PROFILE_IMAGE_FILE_PATTERN);
    const participantId = match?.[1] || "";
    if (!participantId || (allowedIds && !allowedIds.has(participantId))) return [];
    const versionSource = file.updated_at || file.created_at || "1";
    const parsedVersion = Date.parse(versionSource);
    const version = Number.isFinite(parsedVersion) ? parsedVersion : versionSource;
    return [[participantId, getHello2027ProfileImageUrl(participantId, version)] as const];
  }));
}

export async function saveHello2027ProfileImage(
  service: SupabaseClient,
  participantId: string,
  bytes: Uint8Array,
) {
  const { error } = await service.storage
    .from(HELLO_2027_PROFILE_IMAGE_BUCKET)
    .upload(profileImagePath(participantId), bytes, {
      cacheControl: "0",
      contentType: "image/webp",
      upsert: true,
    });
  if (error) throw new Error("Profile image storage write failed.");
  return getHello2027ProfileImageUrl(participantId, Date.now());
}

export async function removeHello2027ProfileImage(service: SupabaseClient, participantId: string) {
  const { error } = await service.storage
    .from(HELLO_2027_PROFILE_IMAGE_BUCKET)
    .remove([profileImagePath(participantId)]);
  if (error) throw new Error("Profile image storage delete failed.");
}

async function storedProfileImageExists(
  service: SupabaseClient,
  participantId: string,
) {
  const fileName = `${participantId}.webp`;
  const { data, error } = await service.storage
    .from(HELLO_2027_PROFILE_IMAGE_BUCKET)
    .list(PROFILE_IMAGE_PREFIX, { limit: 2, search: fileName });
  if (error) return null;
  return (data || []).some((file) => file.name === fileName);
}

async function hasExplicitProfileImagePreference(
  service: SupabaseClient,
  participantId: string,
) {
  const fileName = `${participantId}.preference`;
  const { data, error } = await service.storage
    .from(HELLO_2027_PROFILE_IMAGE_BUCKET)
    .list(PROFILE_IMAGE_EXPLICIT_PREFERENCE_PREFIX, { limit: 2, search: fileName });
  if (error) return null;
  return (data || []).some((file) => file.name === fileName);
}

/** Records a member/admin replacement or deletion so a later login cannot undo it. */
export async function markExplicitHello2027ProfileImagePreference(
  service: SupabaseClient,
  participantId: string,
  preference: "custom" | "removed",
) {
  const { error } = await service.storage
    .from(HELLO_2027_PROFILE_IMAGE_BUCKET)
    .upload(
      profileImageExplicitPreferencePath(participantId),
      new TextEncoder().encode(preference),
      {
        cacheControl: "0",
        contentType: "text/plain; charset=utf-8",
        upsert: true,
      },
    );
  if (error) throw new Error("Profile image preference write failed.");
}

/**
 * Allows Kakao import only when no stored photo and no explicit member/admin
 * choice exists. Existing members therefore receive Kakao's photo on their next
 * login, while an explicit replacement or deletion remains authoritative.
 */
export async function markKakaoProfileImageImportPendingIfEligible(
  service: SupabaseClient,
  participantId: string,
) {
  const [hasExplicitPreference, hasStoredImage] = await Promise.all([
    hasExplicitProfileImagePreference(service, participantId),
    storedProfileImageExists(service, participantId),
  ]);
  // Fail closed if storage state cannot be established: never risk replacing a
  // participant's intentional choice because a metadata lookup was unavailable.
  if (hasExplicitPreference !== false || hasStoredImage !== false) return false;

  const { error } = await service.storage
    .from(HELLO_2027_PROFILE_IMAGE_BUCKET)
    .upload(profileImageImportPendingPath(participantId), new Uint8Array([1]), {
      cacheControl: "0",
      contentType: "application/octet-stream",
      upsert: true,
    });
  return !error;
}

/** Cancels a delayed Kakao import before an explicit member/admin replacement or deletion. */
export async function cancelPendingKakaoProfileImageImport(
  service: SupabaseClient,
  participantId: string,
) {
  const { error } = await service.storage
    .from(HELLO_2027_PROFILE_IMAGE_BUCKET)
    .remove([profileImageImportPendingPath(participantId)]);
  if (error) throw new Error("Profile image import cancellation failed.");
}

async function hasPendingKakaoProfileImageImport(
  service: SupabaseClient,
  participantId: string,
) {
  const { data, error } = await service.storage
    .from(HELLO_2027_PROFILE_IMAGE_BUCKET)
    .download(profileImageImportPendingPath(participantId));
  return !error && Boolean(data && data.size > 0);
}

async function createProfileImageIfAbsent(
  service: SupabaseClient,
  participantId: string,
  bytes: Uint8Array,
) {
  const { error } = await service.storage
    .from(HELLO_2027_PROFILE_IMAGE_BUCKET)
    .upload(profileImagePath(participantId), bytes, {
      cacheControl: "0",
      contentType: "image/webp",
      upsert: false,
    });
  if (!error) return true;

  // If an explicit upload won the race, retire the Kakao import instead of
  // retrying later and replacing the member's chosen photo.
  const { data: existingImage } = await service.storage
    .from(HELLO_2027_PROFILE_IMAGE_BUCKET)
    .download(profileImagePath(participantId));
  if (existingImage?.size) {
    await cancelPendingKakaoProfileImageImport(service, participantId).catch(() => undefined);
  }
  return false;
}

function isSafeKakaoProfileImageUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && !url.port
      && !url.hash
      && (hostname === "kakaocdn.net" || hostname.endsWith(".kakaocdn.net"));
  } catch {
    return false;
  }
}

async function readLimitedResponse(response: Response, maximumBytes: number) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > maximumBytes) throw new Error("remote_profile_image_too_large");
  if (!response.body) throw new Error("remote_profile_image_missing");
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error("remote_profile_image_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return bytes;
}

/**
 * Copies an eligible member's optional Kakao image without retaining the remote
 * URL. Private eligibility and preference markers make retries safe while
 * keeping member/admin replacement and deletion authoritative.
 */
export async function importNewKakaoProfileImage(
  service: SupabaseClient,
  participantId: string,
  remoteUrl: string,
) {
  if (!isSafeKakaoProfileImageUrl(remoteUrl)) return false;
  try {
    if (!await hasPendingKakaoProfileImageImport(service, participantId)) return false;
    if (await hasExplicitProfileImagePreference(service, participantId) !== false) return false;
    const response = await fetch(remoteUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3_000),
      headers: { Accept: "image/webp,image/png,image/jpeg" },
    });
    if (!response.ok) return false;
    const declaredType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (!ACCEPTED_IMAGE_TYPES.has(declaredType)) return false;
    const validation = await normalizeProfileImage(
      await readLimitedResponse(response, MAX_REMOTE_PROFILE_IMAGE_BYTES),
      declaredType,
      MAX_REMOTE_PROFILE_IMAGE_BYTES,
    );
    if (!validation.ok) return false;
    // An explicit delete or replacement can cancel the import while the Kakao
    // image is downloading. Re-check before attempting a create-only write.
    if (!await hasPendingKakaoProfileImageImport(service, participantId)) return false;
    if (await hasExplicitProfileImagePreference(service, participantId) !== false) return false;
    if (!await createProfileImageIfAbsent(service, participantId, validation.bytes)) return false;
    await cancelPendingKakaoProfileImageImport(service, participantId);
    return true;
  } catch {
    return false;
  }
}
