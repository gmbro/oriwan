import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_HELLO_2027_BANNER_CLICK_URL,
  isSafeHello2027BannerClickUrl,
} from "@/lib/hello-2027-banner-contract";
import { FOURTH_SEASON_KEY } from "@/lib/fourth-season-contract";

export const HELLO_2027_BANNER_STORAGE_BUCKET = "photos";
export const HELLO_2027_BANNER_IMAGE_ROUTE = "/api/hello-2027/banner-image";
// The browser accepts 20 MB originals and optimizes transfer below 3 MB.
export const MAX_HELLO_2027_BANNER_IMAGE_BYTES = 20 * 1024 * 1024;
export const HELLO_2027_BANNER_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type BannerImageMimeType = (typeof HELLO_2027_BANNER_IMAGE_MIME_TYPES)[number];
type BannerImageExtension = "jpg" | "png" | "webp";

type ValidatedBannerImage = {
  bytes: Uint8Array;
  contentType: BannerImageMimeType;
  extension: BannerImageExtension;
};

type BannerImageValidation =
  | { ok: true; image: ValidatedBannerImage }
  | { ok: false; error: string; status: 400 | 413 | 415 };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGED_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;
const MAX_LINK_FILE_BYTES = 4 * 1024;
const MAX_BANNER_IMAGE_INPUT_PIXELS = 24_000_000;
const MAX_BANNER_IMAGE_OUTPUT_EDGE = 4_096;
const BANNER_IMAGE_PREFIX = `hello-2027/public-banners/${FOURTH_SEASON_KEY}`;
const BANNER_LINK_CONFIG_PREFIX = `hello-2027/banner-config/${FOURTH_SEASON_KEY}`;

function hasPrefix(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function detectImageType(bytes: Uint8Array): Pick<ValidatedBannerImage, "contentType" | "extension"> | null {
  if (bytes.length >= 3 && hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 8 && hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 12
    && hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

function filenameMatchesType(name: string, extension: BannerImageExtension) {
  const match = name.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return false;
  if (extension === "jpg") return match[1] === "jpg" || match[1] === "jpeg";
  return match[1] === extension;
}

function linkConfigDirectory(userId: string) {
  return `${BANNER_LINK_CONFIG_PREFIX}/${userId}`;
}

function linkConfigPath(userId: string, bannerId: string) {
  return `${linkConfigDirectory(userId)}/${bannerId}.txt`;
}

function isMissingStorageObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; statusCode?: unknown; message?: unknown };
  const status = String(candidate.statusCode ?? candidate.status ?? "");
  const message = String(candidate.message ?? "").toLowerCase();
  return status === "404" || message.includes("not found") || message.includes("not_found");
}

export async function validateHello2027BannerImage(file: File): Promise<BannerImageValidation> {
  if (file.size <= 0) {
    return { ok: false, error: "내용이 없는 이미지는 올릴 수 없어요.", status: 400 };
  }
  if (file.size > MAX_HELLO_2027_BANNER_IMAGE_BYTES) {
    return { ok: false, error: "배너 이미지는 20MB 이하로 올려주세요.", status: 413 };
  }
  if (!(HELLO_2027_BANNER_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "JPG, PNG, WebP 이미지만 올릴 수 있어요.", status: 415 };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "이미지 파일을 읽지 못했어요. 다시 선택해주세요.", status: 400 };
  }
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_HELLO_2027_BANNER_IMAGE_BYTES) {
    return {
      ok: false,
      error: bytes.byteLength > MAX_HELLO_2027_BANNER_IMAGE_BYTES
        ? "배너 이미지는 20MB 이하로 올려주세요."
        : "내용이 없는 이미지는 올릴 수 없어요.",
      status: bytes.byteLength > MAX_HELLO_2027_BANNER_IMAGE_BYTES ? 413 : 400,
    };
  }

  const detected = detectImageType(bytes);
  if (!detected || detected.contentType !== file.type || !filenameMatchesType(file.name, detected.extension)) {
    return { ok: false, error: "파일 확장자와 실제 이미지 형식이 일치하는지 확인해주세요.", status: 415 };
  }

  try {
    const { default: sharp } = await import("sharp");
    const decoder = sharp(bytes, {
      failOn: "warning",
      limitInputPixels: MAX_BANNER_IMAGE_INPUT_PIXELS,
      sequentialRead: true,
    });
    const metadata = await decoder.metadata();
    if (
      !metadata.width
      || !metadata.height
      || metadata.width * metadata.height > MAX_BANNER_IMAGE_INPUT_PIXELS
    ) {
      return { ok: false, error: "이미지 해상도가 너무 커요. 2,400만 화소 이하 이미지를 사용해주세요.", status: 413 };
    }

    const normalized = decoder
      .rotate()
      .resize({
        width: MAX_BANNER_IMAGE_OUTPUT_EDGE,
        height: MAX_BANNER_IMAGE_OUTPUT_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });
    const output = detected.extension === "jpg"
      ? await normalized.jpeg({ quality: 90, progressive: true, mozjpeg: true }).toBuffer()
      : detected.extension === "png"
        ? await normalized.png({ compressionLevel: 9, progressive: true }).toBuffer()
        : await normalized.webp({ quality: 90 }).toBuffer();

    if (output.byteLength <= 0 || output.byteLength > MAX_HELLO_2027_BANNER_IMAGE_BYTES) {
      return { ok: false, error: "변환된 배너 이미지가 20MB를 넘어요. 더 작은 이미지를 사용해주세요.", status: 413 };
    }

    // Sharp re-encoding verifies decodability and strips EXIF/GPS metadata.
    return { ok: true, image: { bytes: new Uint8Array(output), ...detected } };
  } catch {
    return { ok: false, error: "손상되지 않은 JPG, PNG, WebP 이미지인지 확인해주세요.", status: 415 };
  }
}

export function createHello2027BannerImagePath(userId: string, extension: BannerImageExtension) {
  return `${BANNER_IMAGE_PREFIX}/${userId}/${randomUUID()}.${extension}`;
}

export function getHello2027BannerImageUrl(path: string, userId: string) {
  const prefix = `${BANNER_IMAGE_PREFIX}/${userId}/`;
  const filename = path.startsWith(prefix) ? path.slice(prefix.length) : "";
  if (!MANAGED_FILE_PATTERN.test(filename)) throw new Error("Invalid managed banner image path.");
  return `${HELLO_2027_BANNER_IMAGE_ROUTE}/${userId}/${filename}`;
}

/**
 * Returns a storage object path only for files created by this app for the
 * authenticated admin. Static assets and another user's objects are ignored.
 */
export function getOwnedHello2027BannerImagePath(imageUrl: unknown, userId: string) {
  if (typeof imageUrl !== "string") return null;
  const normalized = imageUrl.trim();
  const prefix = `${HELLO_2027_BANNER_IMAGE_ROUTE}/${userId}/`;
  if (!normalized.startsWith(prefix) || normalized.includes("?") || normalized.includes("#")) return null;
  const filename = normalized.slice(prefix.length);
  if (!MANAGED_FILE_PATTERN.test(filename)) return null;
  return `${BANNER_IMAGE_PREFIX}/${userId}/${filename}`;
}

export function getPublicHello2027BannerImagePath(userId: unknown, filename: unknown) {
  if (
    typeof userId !== "string"
    || typeof filename !== "string"
    || !UUID_PATTERN.test(userId)
    || !MANAGED_FILE_PATTERN.test(filename)
  ) {
    return null;
  }
  return `${BANNER_IMAGE_PREFIX}/${userId}/${filename}`;
}

export function bannerImageContentType(path: string): BannerImageMimeType | null {
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.webp$/i.test(path)) return "image/webp";
  return null;
}

export async function loadHello2027BannerClickUrls(
  service: SupabaseClient,
  userId: string,
  bannerIds: readonly string[],
  options?: { throwOnError?: boolean },
) {
  const ids = [...new Set(bannerIds.filter((id) => UUID_PATTERN.test(id)))].slice(0, 10);
  if (!ids.length) return {} as Record<string, string>;

  const { data: files, error: listError } = await service.storage
    .from(HELLO_2027_BANNER_STORAGE_BUCKET)
    .list(linkConfigDirectory(userId), { limit: 100 });
  if (listError) {
    if (options?.throwOnError) throw new Error("Banner link configuration could not be listed.");
    console.error("Banner link configuration could not be listed.");
    return {} as Record<string, string>;
  }
  const availableIds = new Set(
    (files || []).flatMap((file) => {
      const match = file.name.match(/^([0-9a-f-]{36})\.txt$/i);
      return match && UUID_PATTERN.test(match[1]) ? [match[1]] : [];
    }),
  );
  const configuredIds = ids.filter((id) => availableIds.has(id));

  const results = await Promise.all(configuredIds.map(async (bannerId) => {
    const { data, error } = await service.storage
      .from(HELLO_2027_BANNER_STORAGE_BUCKET)
      .download(linkConfigPath(userId, bannerId));
    if (error) {
      if (options?.throwOnError && !isMissingStorageObject(error)) {
        throw new Error("Banner link configuration could not be read.");
      }
      if (!isMissingStorageObject(error)) console.error("Banner link configuration could not be read.");
      return null;
    }
    if (!data || data.size <= 0 || data.size > MAX_LINK_FILE_BYTES) return null;
    const clickUrl = (await data.text()).trim();
    return isSafeHello2027BannerClickUrl(clickUrl) ? [bannerId, clickUrl] as const : null;
  }));

  return Object.fromEntries(results.filter((entry): entry is readonly [string, string] => Boolean(entry)));
}

export async function setHello2027BannerClickUrl(
  service: SupabaseClient,
  userId: string,
  bannerId: string,
  clickUrl: string | null,
) {
  if (!UUID_PATTERN.test(bannerId)) throw new Error("Invalid banner id.");
  if (clickUrl !== null && !isSafeHello2027BannerClickUrl(clickUrl)) throw new Error("Invalid banner URL.");
  const path = linkConfigPath(userId, bannerId);
  if (clickUrl === null || clickUrl.trim() === DEFAULT_HELLO_2027_BANNER_CLICK_URL) {
    const { error } = await service.storage.from(HELLO_2027_BANNER_STORAGE_BUCKET).remove([path]);
    if (error && !isMissingStorageObject(error)) throw new Error("Banner link configuration could not be removed.");
    return;
  }

  const bytes = new TextEncoder().encode(clickUrl.trim());
  if (bytes.byteLength > MAX_LINK_FILE_BYTES) throw new Error("Banner link configuration is too large.");
  const { error } = await service.storage
    .from(HELLO_2027_BANNER_STORAGE_BUCKET)
    .upload(path, bytes, {
      cacheControl: "0",
      contentType: "text/plain; charset=utf-8",
      upsert: true,
    });
  if (error) throw new Error("Banner link configuration could not be saved.");
}

export async function removeUnusedHello2027BannerImage(
  service: SupabaseClient,
  userId: string,
  imageUrl: unknown,
) {
  const path = getOwnedHello2027BannerImagePath(imageUrl, userId);
  if (!path || typeof imageUrl !== "string") return;

  // An operator may intentionally reuse one uploaded image across banners.
  // Remove the object only after the last database reference is gone.
  const { count, error: referenceError } = await service
    .from("hello_2027_banners")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("season_key", FOURTH_SEASON_KEY)
    .eq("image_url", imageUrl.trim());
  if (referenceError || (count || 0) > 0) {
    if (referenceError) console.error("Banner image reference check failed; object cleanup was skipped.");
    return;
  }

  const { error } = await service.storage.from(HELLO_2027_BANNER_STORAGE_BUCKET).remove([path]);
  if (error) console.error("Unused banner image cleanup failed.");
}
