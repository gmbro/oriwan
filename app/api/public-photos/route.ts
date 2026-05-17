import { NextRequest, NextResponse } from "next/server";
import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import {
  GALLERY_BUCKET,
  GALLERY_SIGNED_URL_SECONDS,
  cleanGalleryAlbumTitle,
  formatGalleryDateLabel,
  isGalleryImageFile,
  parseGalleryDate,
} from "@/lib/gallery-photos";
import { guardReadRequest } from "@/lib/request-security";

const PUBLIC_PHOTOS_CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const PUBLIC_PHOTOS_MEMORY_CACHE_TTL_MS = 60_000;
const PUBLIC_PHOTOS_RATE_LIMIT = {
  key: "public-photos-read",
  limit: 120,
  windowMs: 60_000,
  message: "사진첩 요청이 잠시 몰렸어요. 조금 뒤 새로고침해주세요.",
};
const MAX_ROOT_ITEMS = 80;
const MAX_FILES_PER_FOLDER = 120;
const MAX_PHOTOS = 240;

type StorageItem = {
  name: string;
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_accessed_at?: string | null;
  metadata?: {
    mimetype?: string;
    size?: number;
  } | null;
};

type GalleryPhotoDraft = {
  path: string;
  name: string;
  displayDate: string;
  dateLabel: string;
  albumTitle: string;
  sortKey: string;
};

type PublicPhotosPayload = {
  bucket: string;
  generated_at: string;
  total_count: number;
  groups: {
    date: string;
    date_label: string;
    album_title: string;
    photos: {
      id: string;
      name: string;
      path: string;
      url: string;
    }[];
  }[];
  setup_required?: boolean;
  error?: string;
};

type PublicPhotosCacheEntry = {
  expiresAt: number;
  payload?: PublicPhotosPayload;
  promise?: Promise<PublicPhotosPayload>;
};

let publicPhotosCache: PublicPhotosCacheEntry | null = null;

function publicPhotosResponse(payload: unknown, cacheStatus = "MISS") {
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", PUBLIC_PHOTOS_CACHE_CONTROL);
  response.headers.set("X-Oriwan-Photo-Cache", cacheStatus);
  return response;
}

function storageDate(item: StorageItem) {
  const dateText = item.created_at || item.updated_at || item.last_accessed_at;
  return dateText ? dateText.slice(0, 10) : null;
}

function addDraft(drafts: GalleryPhotoDraft[], input: {
  folderName?: string;
  item: StorageItem;
  path: string;
  fallbackDate?: string | null;
}) {
  if (!isGalleryImageFile(input.item.name)) return;

  const displayDate = parseGalleryDate(input.path) || input.fallbackDate || storageDate(input.item);
  if (!displayDate) return;

  drafts.push({
    path: input.path,
    name: input.item.name,
    displayDate,
    dateLabel: formatGalleryDateLabel(displayDate),
    albumTitle: input.folderName ? cleanGalleryAlbumTitle(input.folderName, displayDate) : formatGalleryDateLabel(displayDate),
    sortKey: `${displayDate}-${input.path}`,
  });
}

async function buildPublicPhotosPayload(): Promise<PublicPhotosPayload> {
  const supabase = getServiceClient();
  if (!supabase) throw new Error("공개 사진첩 환경변수가 설정되지 않았습니다.");

  const adminUserId = await findAdminUserId(supabase);
  if (!adminUserId) throw new Error("관리자 계정을 찾지 못했습니다.");

  const bucket = supabase.storage.from(GALLERY_BUCKET);
  const { data: rootItems, error: rootError } = await bucket.list("", {
    limit: MAX_ROOT_ITEMS,
    sortBy: { column: "name", order: "asc" },
  });

  if (rootError) {
    const message = rootError.message || "사진첩 버킷을 읽지 못했어요.";
    if (/not found|does not exist|bucket/i.test(message)) {
      return {
        bucket: GALLERY_BUCKET,
        generated_at: new Date().toISOString(),
        total_count: 0,
        groups: [],
        setup_required: true,
        error: `Supabase Storage에 ${GALLERY_BUCKET} 버킷을 먼저 만들어주세요.`,
      };
    }
    throw rootError;
  }

  const drafts: GalleryPhotoDraft[] = [];

  for (const rootItem of (rootItems || []) as StorageItem[]) {
    if (isGalleryImageFile(rootItem.name)) {
      addDraft(drafts, {
        item: rootItem,
        path: rootItem.name,
      });
      continue;
    }

    const folderName = rootItem.name;
    const folderDate = parseGalleryDate(folderName);
    const { data: folderItems, error: folderError } = await bucket.list(folderName, {
      limit: MAX_FILES_PER_FOLDER,
      sortBy: { column: "name", order: "asc" },
    });

    if (folderError) continue;

    for (const folderItem of (folderItems || []) as StorageItem[]) {
      addDraft(drafts, {
        folderName,
        item: folderItem,
        path: `${folderName}/${folderItem.name}`,
        fallbackDate: folderDate,
      });
    }
  }

  const sortedDrafts = drafts
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, MAX_PHOTOS);
  const paths = sortedDrafts.map((draft) => draft.path);
  const signedUrlByPath = new Map<string, string>();

  if (paths.length) {
    const { data: signedUrls, error: signedUrlError } = await bucket.createSignedUrls(paths, GALLERY_SIGNED_URL_SECONDS);
    if (signedUrlError) throw signedUrlError;

    for (const signedUrl of signedUrls || []) {
      if (signedUrl.path && signedUrl.signedUrl) {
        signedUrlByPath.set(signedUrl.path, signedUrl.signedUrl);
      }
    }
  }

  const grouped = new Map<string, PublicPhotosPayload["groups"][number]>();

  for (const draft of sortedDrafts) {
    const url = signedUrlByPath.get(draft.path);
    if (!url) continue;

    const groupKey = draft.displayDate;
    const group = grouped.get(groupKey) || {
      date: draft.displayDate,
      date_label: draft.dateLabel,
      album_title: draft.albumTitle,
      photos: [],
    };

    group.photos.push({
      id: draft.path,
      name: draft.name,
      path: draft.path,
      url,
    });
    grouped.set(groupKey, group);
  }

  const groups = Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date));

  return {
    bucket: GALLERY_BUCKET,
    generated_at: new Date().toISOString(),
    total_count: groups.reduce((sum, group) => sum + group.photos.length, 0),
    groups,
  };
}

async function getPublicPhotosPayload(bypassCache: boolean) {
  const now = Date.now();
  if (!bypassCache) {
    if (publicPhotosCache?.payload && publicPhotosCache.expiresAt > now) {
      return { payload: publicPhotosCache.payload, cacheStatus: "HIT" };
    }
    if (publicPhotosCache?.promise) {
      return { payload: await publicPhotosCache.promise, cacheStatus: "DEDUPED" };
    }
  }

  const promise = buildPublicPhotosPayload();
  if (!bypassCache) publicPhotosCache = { expiresAt: 0, promise, payload: publicPhotosCache?.payload };

  try {
    const payload = await promise;
    if (!bypassCache) {
      publicPhotosCache = {
        expiresAt: Date.now() + PUBLIC_PHOTOS_MEMORY_CACHE_TTL_MS,
        payload,
      };
    }
    return { payload, cacheStatus: bypassCache ? "BYPASS" : "MISS" };
  } catch (error) {
    if (!bypassCache && publicPhotosCache?.payload) {
      publicPhotosCache = {
        expiresAt: Date.now() + PUBLIC_PHOTOS_MEMORY_CACHE_TTL_MS,
        payload: publicPhotosCache.payload,
      };
      return { payload: publicPhotosCache.payload, cacheStatus: "STALE" };
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: PUBLIC_PHOTOS_RATE_LIMIT,
  });
  if (guardResponse) return guardResponse;

  try {
    const bypassCache = request.nextUrl.searchParams.get("refresh") === "1";
    const { payload, cacheStatus } = await getPublicPhotosPayload(bypassCache);
    return publicPhotosResponse(payload, cacheStatus);
  } catch (error) {
    console.error("Public photos error:", error);
    return NextResponse.json({ error: "사진첩을 불러오는 중 문제가 생겼어요.", groups: [] }, { status: 500 });
  }
}
