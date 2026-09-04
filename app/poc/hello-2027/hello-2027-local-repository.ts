"use client";

import type {
  Hello2027Ad,
  Hello2027AuthorMode,
  Hello2027GuestbookReply,
  Hello2027GuestbookThread,
  Hello2027ProfileIntroduction,
  Hello2027Reaction,
} from "./hello-2027-poc-data";

const DATABASE_NAME = "twtt-hello-2027-poc";
const DATABASE_VERSION = 1;
const DATA_STORE = "data";
const MEDIA_STORE = "media";
const CONFIG_KEY = "dashboard-config";
const GUESTBOOK_KEY = "guestbook";
const CHANGE_EVENT = "hello-2027-local-change";
const CHANGE_CHANNEL = "hello-2027-poc";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_LOCAL_ADS = 10;
export const MAX_LOCAL_QUOTES = 56;
export const MAX_PROFILE_TITLE_LENGTH = 40;
export const MAX_PROFILE_BODY_LENGTH = 160;
export const MAX_GUESTBOOK_BODY_LENGTH = 150;
export const MAX_GUESTBOOK_AUTHOR_LENGTH = 12;
const MAX_GUESTBOOK_THREADS = 200;
const MAX_GUESTBOOK_REPLIES = 50;
const MAX_REACTION_COUNT = 9_999;
const REACTION_EMOJIS = new Set<Hello2027Reaction["emoji"]>(["👍", "❤️", "👏", "🌱", "🏃"]);

export type Hello2027LocalConfig = {
  version: 3;
  ads: Hello2027Ad[];
  avatars: Record<string, string>;
  encouragements: string[];
  profileIntroductions: Record<string, Hello2027ProfileIntroduction>;
};

export type OptimizedImage = {
  blob: Blob;
  width: number;
  height: number;
};

type MediaMutation = {
  id: string;
  blob: Blob;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("로컬 저장소 요청에 실패했어요."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("로컬 저장을 마치지 못했어요."));
    transaction.onabort = () => reject(transaction.error ?? new Error("로컬 저장이 중단됐어요."));
  });
}

function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DATA_STORE)) database.createObjectStore(DATA_STORE);
      if (!database.objectStoreNames.contains(MEDIA_STORE)) database.createObjectStore(MEDIA_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("브라우저 로컬 저장소를 열지 못했어요."));
    request.onblocked = () => reject(new Error("다른 탭에서 로컬 저장소를 사용 중이에요. 잠시 뒤 다시 시도해주세요."));
  });

  return databasePromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isSafeToken(value: unknown, maxLength: number): value is string {
  return isNonEmptyText(value, maxLength) && /^[A-Za-z0-9:._-]+$/.test(value);
}

function isHello2027Ad(value: unknown): value is Hello2027Ad {
  if (!isRecord(value)) return false;
  const imageSrc = value.imageSrc;
  return isSafeToken(value.id, 100)
    && isNonEmptyText(value.ownerName, 20)
    && isNonEmptyText(value.title, 40)
    && isNonEmptyText(value.description, 100)
    && isNonEmptyText(value.alt, 80)
    && typeof imageSrc === "string"
    && imageSrc.startsWith("/images/poc/hello-2027/")
    && !imageSrc.includes("..")
    && (value.mediaId === undefined || isSafeToken(value.mediaId, 120));
}

function isProfileIntroduction(value: unknown): value is Hello2027ProfileIntroduction {
  return isRecord(value)
    && isNonEmptyText(value.title, MAX_PROFILE_TITLE_LENGTH)
    && isNonEmptyText(value.body, MAX_PROFILE_BODY_LENGTH);
}

function normalizeLocalConfig(value: unknown): Hello2027LocalConfig | null {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2 && value.version !== 3)) return null;
  if (!Array.isArray(value.ads) || value.ads.length > MAX_LOCAL_ADS || !value.ads.every(isHello2027Ad)) return null;
  if (!isRecord(value.avatars)) return null;

  const avatars: Record<string, string> = {};
  for (const [participantId, mediaId] of Object.entries(value.avatars)) {
    if (isSafeToken(participantId, 100) && isSafeToken(mediaId, 120)) {
      avatars[participantId] = mediaId;
    }
  }
  const rawEncouragements = Array.isArray(value.encouragements) ? value.encouragements : [];
  if (rawEncouragements.length > MAX_LOCAL_QUOTES) return null;
  const encouragements = rawEncouragements.filter((item): item is string => isNonEmptyText(item, 120));
  if (encouragements.length !== rawEncouragements.length) return null;

  if (value.version === 3 && !isRecord(value.profileIntroductions)) return null;
  const profileIntroductions: Record<string, Hello2027ProfileIntroduction> = {};
  if (isRecord(value.profileIntroductions)) {
    const introductionEntries = Object.entries(value.profileIntroductions);
    if (introductionEntries.length > 100) return null;
    for (const [participantId, introduction] of introductionEntries) {
      if (!isSafeToken(participantId, 100) || !isProfileIntroduction(introduction)) return null;
      profileIntroductions[participantId] = { ...introduction };
    }
  }

  return {
    version: 3,
    ads: value.ads.map((ad) => ({ ...ad })),
    avatars,
    encouragements,
    profileIntroductions,
  };
}

function announceLocalChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANGE_CHANNEL);
  channel.postMessage({ type: "content-changed", at: Date.now() });
  channel.close();
}

export function subscribeToLocalHello2027Content(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANGE_CHANNEL);
  if (channel) channel.onmessage = onChange;

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    channel?.close();
  };
}

export async function readLocalHello2027Config() {
  const database = await openDatabase();
  const transaction = database.transaction(DATA_STORE, "readonly");
  const value = await requestResult(transaction.objectStore(DATA_STORE).get(CONFIG_KEY));
  return normalizeLocalConfig(value);
}

export async function writeLocalHello2027Config(
  config: Hello2027LocalConfig,
  mediaWrites: readonly MediaMutation[] = [],
  mediaDeletes: readonly string[] = [],
) {
  if (config.ads.length > MAX_LOCAL_ADS) throw new Error(`광고는 최대 ${MAX_LOCAL_ADS}개까지 등록할 수 있어요.`);
  if (config.encouragements.length > MAX_LOCAL_QUOTES) throw new Error(`응원글은 최대 ${MAX_LOCAL_QUOTES}개까지 등록할 수 있어요.`);
  if (!normalizeLocalConfig(config)) throw new Error("저장할 운영자 데이터 형식이 올바르지 않아요.");

  const database = await openDatabase();
  const transaction = database.transaction([DATA_STORE, MEDIA_STORE], "readwrite");
  transaction.objectStore(DATA_STORE).put(config, CONFIG_KEY);
  const mediaStore = transaction.objectStore(MEDIA_STORE);
  mediaWrites.forEach((media) => mediaStore.put(media.blob, media.id));
  mediaDeletes.forEach((mediaId) => mediaStore.delete(mediaId));
  await transactionComplete(transaction);
  announceLocalChange();
}

export async function readLocalMedia(mediaId: string) {
  const database = await openDatabase();
  const transaction = database.transaction(MEDIA_STORE, "readonly");
  const value = await requestResult(transaction.objectStore(MEDIA_STORE).get(mediaId));
  return value instanceof Blob ? value : null;
}

export async function readLocalGuestbook() {
  const database = await openDatabase();
  const transaction = database.transaction(DATA_STORE, "readonly");
  const value = await requestResult(transaction.objectStore(DATA_STORE).get(GUESTBOOK_KEY));
  if (!Array.isArray(value) || value.length > MAX_GUESTBOOK_THREADS) return null;
  return value.every(isGuestbookThread) ? value.map(cloneGuestbookThread) : null;
}

export async function writeLocalGuestbook(threads: readonly Hello2027GuestbookThread[]) {
  if (threads.length > MAX_GUESTBOOK_THREADS || !threads.every(isGuestbookThread)) {
    throw new Error("저장할 이야기 형식이 올바르지 않아요.");
  }
  const database = await openDatabase();
  const transaction = database.transaction(DATA_STORE, "readwrite");
  transaction.objectStore(DATA_STORE).put(threads, GUESTBOOK_KEY);
  await transactionComplete(transaction);
}

function isAuthorMode(value: unknown): value is Hello2027AuthorMode {
  return value === "real" || value === "random" || value === "kakao";
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function isGuestbookReply(value: unknown): value is Hello2027GuestbookReply {
  if (!isRecord(value)) return false;
  return isSafeToken(value.id, 120)
    && isNonEmptyText(value.author, MAX_GUESTBOOK_AUTHOR_LENGTH)
    && isAuthorMode(value.authorMode)
    && isNonEmptyText(value.body, MAX_GUESTBOOK_BODY_LENGTH)
    && isIsoDate(value.createdAt)
    && isReactionList(value.reactions);
}

function isGuestbookThread(value: unknown): value is Hello2027GuestbookThread {
  if (!isRecord(value) || !Array.isArray(value.replies) || value.replies.length > MAX_GUESTBOOK_REPLIES) return false;
  return isSafeToken(value.id, 120)
    && isNonEmptyText(value.author, MAX_GUESTBOOK_AUTHOR_LENGTH)
    && isAuthorMode(value.authorMode)
    && isNonEmptyText(value.body, MAX_GUESTBOOK_BODY_LENGTH)
    && isIsoDate(value.createdAt)
    && isReactionList(value.reactions)
    && value.replies.every(isGuestbookReply);
}

function isReactionList(value: unknown) {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > REACTION_EMOJIS.size) return false;
  const seen = new Set<string>();
  return value.every((reaction) => {
    if (!isRecord(reaction) || typeof reaction.emoji !== "string" || seen.has(reaction.emoji)) return false;
    seen.add(reaction.emoji);
    return REACTION_EMOJIS.has(reaction.emoji as Hello2027Reaction["emoji"])
      && Number.isInteger(reaction.count)
      && typeof reaction.count === "number"
      && reaction.count > 0
      && reaction.count <= MAX_REACTION_COUNT
      && typeof reaction.reacted === "boolean";
  });
}

function cloneGuestbookThread(thread: Hello2027GuestbookThread): Hello2027GuestbookThread {
  return {
    ...thread,
    reactions: (thread.reactions ?? []).map((reaction) => ({ ...reaction })),
    replies: thread.replies.map((reply) => ({
      ...reply,
      reactions: (reply.reactions ?? []).map((reaction) => ({ ...reaction })),
    })),
  };
}

async function hasSupportedSignature(file: File) {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  const isWebp = String.fromCharCode(...header.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  return isJpeg || isPng || isWebp;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("이미지를 가볍게 변환하지 못했어요.")),
      "image/webp",
      quality,
    );
  });
}

export async function optimizeLocalImage(file: File, kind: "ad" | "avatar"): Promise<OptimizedImage> {
  const maxFileSize = kind === "ad" ? 5_000_000 : 3_000_000;
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || !(await hasSupportedSignature(file))) {
    throw new Error("JPG, PNG, WebP 이미지만 등록할 수 있어요.");
  }
  if (file.size > maxFileSize) {
    throw new Error(kind === "ad" ? "광고 이미지는 5MB 이하로 올려주세요." : "얼굴 이미지는 3MB 이하로 올려주세요.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 24_000_000) throw new Error("이미지 해상도가 너무 커요. 2,400만 화소 이하 이미지를 사용해주세요.");

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 처리할 수 없는 브라우저예요.");

    if (kind === "avatar") {
      const sourceEdge = Math.min(bitmap.width, bitmap.height);
      const sourceX = Math.round((bitmap.width - sourceEdge) / 2);
      const sourceY = Math.round((bitmap.height - sourceEdge) / 2);
      const outputEdge = Math.min(512, sourceEdge);
      canvas.width = outputEdge;
      canvas.height = outputEdge;
      context.drawImage(bitmap, sourceX, sourceY, sourceEdge, sourceEdge, 0, 0, outputEdge, outputEdge);
    } else {
      const scale = Math.min(1, 1600 / bitmap.width, 900 / bitmap.height);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }

    let blob = await canvasToBlob(canvas, kind === "ad" ? 0.84 : 0.82);
    const resultLimit = kind === "ad" ? 1_200_000 : 300_000;
    if (blob.size > resultLimit) blob = await canvasToBlob(canvas, 0.66);
    if (blob.size > resultLimit) throw new Error("이미지 용량을 충분히 줄이지 못했어요. 더 작은 이미지를 사용해주세요.");

    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close();
  }
}

export async function getLocalStorageEstimate() {
  if (!navigator.storage?.estimate) return null;
  return navigator.storage.estimate();
}
