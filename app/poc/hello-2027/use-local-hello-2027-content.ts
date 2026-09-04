"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Hello2027Ad, Hello2027ProfileIntroduction } from "./hello-2027-poc-data";
import {
  MAX_HELLO_2027_PROFILE_INTRODUCTIONS,
  MAX_PROFILE_INTRO_LENGTH,
  MAX_PROFILE_INTRO_NAME_LENGTH,
  MAX_PROFILE_INTRO_TITLE_LENGTH,
} from "@/lib/hello-2027-profile-introduction-contract";
import {
  readLocalHello2027Config,
  readLocalMedia,
  subscribeToLocalHello2027Content,
} from "./hello-2027-local-repository";

export type ResolvedHello2027Ad = Hello2027Ad & {
  isUploaded: boolean;
};

type LocalContent = {
  ads: ResolvedHello2027Ad[];
  avatarUrls: Record<string, string>;
  encouragements: string[];
  profileIntroductions: Record<string, Hello2027ProfileIntroduction>;
};

type PublishedContent = {
  source?: unknown;
  encouragements?: unknown;
  banners?: unknown;
  profileIntroductions?: unknown;
};

const UNSAFE_TEXT_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const UNSAFE_URL_PATTERN = /[\u0000-\u0020\u007f-\u009f\\\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string" || UNSAFE_TEXT_PATTERN.test(value)) return null;
  const text = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  return text && text.length <= maxLength ? text : null;
}

function isSafePublishedImageSrc(value: string) {
  if (UNSAFE_URL_PATTERN.test(value)) return false;
  if (value.startsWith("/")) {
    if (value.startsWith("//")) return false;
    try {
      let pathname = new URL(value, "https://twtt.invalid").pathname;
      for (let index = 0; index < 3; index += 1) {
        const decoded = decodeURIComponent(pathname);
        if (decoded === pathname) break;
        pathname = decoded;
      }
      return !pathname.includes("\\")
        && !pathname.split("/").some((segment) => segment === "." || segment === "..");
    } catch {
      return false;
    }
  }

  try {
    const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!configuredSupabaseUrl) return false;
    const candidate = new URL(value);
    return candidate.protocol === "https:"
      && candidate.origin === new URL(configuredSupabaseUrl).origin
      && candidate.pathname.startsWith("/storage/v1/object/public/")
      && !candidate.username
      && !candidate.password;
  } catch {
    return false;
  }
}

function cleanPublishedAd(value: unknown): ResolvedHello2027Ad | null {
  if (!isRecord(value)) return null;
  const id = cleanText(value.id, 100);
  const ownerName = cleanText(value.ownerName, 20);
  const title = cleanText(value.title, 40);
  const description = cleanText(value.description, 100);
  const alt = cleanText(value.alt, 80);
  const imageSrc = cleanText(value.imageSrc, 2_000);
  const mobileFocus = value.mobileFocus === "left" || value.mobileFocus === "right"
    ? value.mobileFocus
    : "center";
  const safeImage = Boolean(imageSrc && isSafePublishedImageSrc(imageSrc));
  if (!id || !ownerName || !title || !description || !alt || !imageSrc || !safeImage) return null;
  return {
    id,
    ownerName,
    title,
    description,
    alt,
    imageSrc,
    mobileFocus,
    isUploaded: imageSrc.startsWith("https://"),
  };
}

function cleanPublishedContent(value: PublishedContent, defaultAds: readonly Hello2027Ad[], defaultEncouragements: readonly string[]): LocalContent {
  const source = isRecord(value.source) ? value.source : null;
  const encouragementsPublished = value.source === "supabase" || source?.encouragements === "supabase";
  const bannersPublished = value.source === "supabase" || source?.banners === "supabase";
  const profilesPublished = value.source === "supabase" || source?.profileIntroductions === "supabase";

  const publishedAds = Array.isArray(value.banners)
    ? value.banners.slice(0, 10).map(cleanPublishedAd).filter((ad): ad is ResolvedHello2027Ad => Boolean(ad))
    : [];
  const publishedEncouragements = Array.isArray(value.encouragements)
    ? value.encouragements.slice(0, 56).map((item) => (
      isRecord(item) ? cleanText(item.message, 120) : cleanText(item, 120)
    )).filter((item): item is string => Boolean(item))
    : [];
  const profileIntroductions: Record<string, Hello2027ProfileIntroduction> = {};
  if (Array.isArray(value.profileIntroductions)) {
    value.profileIntroductions.slice(0, MAX_HELLO_2027_PROFILE_INTRODUCTIONS).forEach((item) => {
      if (!isRecord(item)) return;
      const participantId = cleanText(item.participantId, 100);
      const name = cleanText(item.name, MAX_PROFILE_INTRO_NAME_LENGTH);
      const title = cleanText(item.title, MAX_PROFILE_INTRO_TITLE_LENGTH);
      const body = cleanText(item.body, MAX_PROFILE_INTRO_LENGTH);
      if (!title || !body) return;
      const introduction = { title, body };
      if (participantId) profileIntroductions[participantId] = introduction;
      if (name) profileIntroductions[`name:${name.replace(/\s+/g, "")}`] = introduction;
    });
  }

  return {
    ads: bannersPublished
      ? publishedAds
      : defaultAds.map((ad) => ({ ...ad, isUploaded: false })),
    avatarUrls: {},
    encouragements: encouragementsPublished ? publishedEncouragements : [...defaultEncouragements],
    profileIntroductions: profilesPublished ? profileIntroductions : {},
  };
}

export function useLocalHello2027Content(
  defaultAds: readonly Hello2027Ad[],
  defaultEncouragements: readonly string[] = [],
  preferPublishedContent = false,
) {
  const [content, setContent] = useState<LocalContent>(() => ({
    ads: defaultAds.map((ad) => ({ ...ad, isUploaded: false })),
    avatarUrls: {},
    encouragements: [...defaultEncouragements],
    profileIntroductions: {},
  }));
  const objectUrlsRef = useRef<string[]>([]);

  const refresh = useCallback(async () => {
    if (preferPublishedContent) {
      try {
        const response = await fetch("/api/hello-2027/content", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("published_content_failed");
        const published = await response.json() as PublishedContent;
        objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        objectUrlsRef.current = [];
        setContent(cleanPublishedContent(published, defaultAds, defaultEncouragements));
        return;
      } catch {
        objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        objectUrlsRef.current = [];
        setContent({
          ads: defaultAds.map((ad) => ({ ...ad, isUploaded: false })),
          avatarUrls: {},
          encouragements: [...defaultEncouragements],
          profileIntroductions: {},
        });
        return;
      }
    }

    const config = await readLocalHello2027Config().catch(() => null);
    if (!config) {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
      setContent({
        ads: defaultAds.map((ad) => ({ ...ad, isUploaded: false })),
        avatarUrls: {},
        encouragements: [...defaultEncouragements],
        profileIntroductions: {},
      });
      return;
    }

    const nextObjectUrls: string[] = [];
    const ads = await Promise.all(config.ads.map(async (ad) => {
      if (!ad.mediaId) return { ...ad, isUploaded: false };
      const blob = await readLocalMedia(ad.mediaId).catch(() => null);
      if (!blob) return { ...ad, isUploaded: false };
      const imageSrc = URL.createObjectURL(blob);
      nextObjectUrls.push(imageSrc);
      return { ...ad, imageSrc, isUploaded: true };
    }));

    const avatarUrls: Record<string, string> = {};
    await Promise.all(Object.entries(config.avatars).map(async ([participantId, mediaId]) => {
      const blob = await readLocalMedia(mediaId).catch(() => null);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      nextObjectUrls.push(url);
      avatarUrls[participantId] = url;
    }));

    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = nextObjectUrls;
    setContent({
      ads,
      avatarUrls,
      encouragements: config.encouragements.length > 0
        ? [...config.encouragements]
        : [...defaultEncouragements],
      profileIntroductions: Object.fromEntries(
        Object.entries(config.profileIntroductions).map(([participantId, introduction]) => [participantId, { ...introduction }]),
      ),
    });
  }, [defaultAds, defaultEncouragements, preferPublishedContent]);

  useEffect(() => {
    let active = true;
    const runRefresh = () => {
      if (!active) return;
      void refresh();
    };

    runRefresh();
    const unsubscribe = preferPublishedContent
      ? () => undefined
      : subscribeToLocalHello2027Content(runRefresh);
    return () => {
      active = false;
      unsubscribe();
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, [preferPublishedContent, refresh]);

  return content;
}
