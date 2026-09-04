"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Hello2027Ad, Hello2027ProfileIntroduction } from "./hello-2027-poc-data";
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

export function useLocalHello2027Content(
  defaultAds: readonly Hello2027Ad[],
  defaultEncouragements: readonly string[] = [],
) {
  const [content, setContent] = useState<LocalContent>(() => ({
    ads: defaultAds.map((ad) => ({ ...ad, isUploaded: false })),
    avatarUrls: {},
    encouragements: [...defaultEncouragements],
    profileIntroductions: {},
  }));
  const objectUrlsRef = useRef<string[]>([]);

  const refresh = useCallback(async () => {
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
  }, [defaultAds, defaultEncouragements]);

  useEffect(() => {
    let active = true;
    const runRefresh = () => {
      if (!active) return;
      void refresh();
    };

    runRefresh();
    const unsubscribe = subscribeToLocalHello2027Content(runRefresh);
    return () => {
      active = false;
      unsubscribe();
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, [refresh]);

  return content;
}
