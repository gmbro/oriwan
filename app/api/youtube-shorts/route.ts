import { NextRequest, NextResponse } from "next/server";
import {
  getCuratedYoutubeShortTips,
  isRecoveryYoutubeTipCategory,
  tipCategoryLabels,
  youtubeThumbnailUrl,
} from "@/lib/youtube-shorts";
import type { TipCategory, YoutubeShortTip } from "@/lib/youtube-shorts";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 12;
const SEARCH_SIZE = 50;
const MAX_SEEN_IDS = 240;

const categoryQueries: Record<TipCategory, string> = {
  running: "러닝 후 회복 리커버리 스트레칭 shorts",
  stretching: "러닝 후 스트레칭 쿨다운 하체 종아리 회복 shorts",
  recovery: "러닝 후 회복 리커버리 스트레칭 shorts",
};

const recoveryIncludePattern = /러닝\s*후|달리기\s*후|운동\s*후|쿨다운|회복|리커버리|스트레칭|폼롤러|종아리|햄스트링|발목|무릎|하체|피로|근막|마사지/i;
const recoveryBlockPattern = /러닝\s*전|달리기\s*전|운동\s*전|워밍업|준비운동|드릴|자세교정|착지|페이스/i;

type YoutubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
};

type YoutubeVideoItem = {
  id?: string;
  snippet?: YoutubeSearchItem["snippet"];
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean };
};

function parseLimit(value: string | null) {
  const parsed = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIMIT);
}

function parseSeed(value: string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSeenIds(value: string | null) {
  if (!value) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^[a-zA-Z0-9_-]{6,20}$/.test(id))
      .slice(0, MAX_SEEN_IDS)
  );
}

function parseIsoDurationSeconds(duration?: string) {
  if (!duration) return Number.POSITIVE_INFINITY;
  const matched = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!matched) return Number.POSITIVE_INFINITY;
  const [, hours = "0", minutes = "0", seconds = "0"] = matched;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function sanitizeText(value?: string) {
  return (value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function isRecoveryRelevantTitle(value: string) {
  const normalized = value.replace(/\s+/g, " ");
  return recoveryIncludePattern.test(normalized) && !recoveryBlockPattern.test(normalized);
}

async function fetchYoutubeShorts(category: TipCategory, limit: number, pageToken: string | null, seenIds: Set<string>) {
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_YOUTUBE_API_KEY;
  if (!apiKey) return { tips: [] as YoutubeShortTip[], nextPageToken: "" };

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", categoryQueries[category]);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("order", "date");
  searchUrl.searchParams.set("videoDuration", "short");
  searchUrl.searchParams.set("maxResults", String(SEARCH_SIZE));
  searchUrl.searchParams.set("regionCode", "KR");
  searchUrl.searchParams.set("relevanceLanguage", "ko");
  searchUrl.searchParams.set("safeSearch", "strict");
  searchUrl.searchParams.set("key", apiKey);
  if (pageToken) searchUrl.searchParams.set("pageToken", pageToken);

  const searchResponse = await fetch(searchUrl, { cache: "no-store" });
  if (!searchResponse.ok) return { tips: [] as YoutubeShortTip[], nextPageToken: "" };

  const searchJson = (await searchResponse.json()) as { items?: YoutubeSearchItem[]; nextPageToken?: string };
  const ids = Array.from(
    new Set((searchJson.items || []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id && !seenIds.has(id))))
  );
  if (!ids.length) return { tips: [] as YoutubeShortTip[], nextPageToken: searchJson.nextPageToken || "" };

  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("part", "snippet,contentDetails,status");
  videosUrl.searchParams.set("id", ids.join(","));
  videosUrl.searchParams.set("key", apiKey);

  const videosResponse = await fetch(videosUrl, { cache: "no-store" });
  if (!videosResponse.ok) return { tips: [] as YoutubeShortTip[], nextPageToken: searchJson.nextPageToken || "" };

  const videosJson = (await videosResponse.json()) as { items?: YoutubeVideoItem[] };
  const videosById = new Map((videosJson.items || []).map((item) => [item.id, item]));

  const tips = ids
    .map((id) => videosById.get(id))
    .filter((item): item is YoutubeVideoItem => Boolean(item?.id))
      .filter((item) => item.id)
      .filter((item) => item.status?.embeddable !== false)
      .filter((item) => parseIsoDurationSeconds(item.contentDetails?.duration) <= 120)
      .filter((item) => isRecoveryRelevantTitle(sanitizeText(item.snippet?.title)))
      .map((item): YoutubeShortTip => {
        const id = item.id || "";
        return {
          id,
          title: sanitizeText(item.snippet?.title) || `${tipCategoryLabels[category]} 쇼츠`,
          channel: sanitizeText(item.snippet?.channelTitle) || "YouTube Shorts",
          category,
          tag: tipCategoryLabels[category],
          publishedAt: item.snippet?.publishedAt,
          thumbnailUrl:
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            youtubeThumbnailUrl(id),
        };
      })
      .slice(0, limit);

  return {
    tips,
    nextPageToken: searchJson.nextPageToken || "",
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requestedCategory = params.get("category");
  const category: TipCategory = isRecoveryYoutubeTipCategory(requestedCategory) ? requestedCategory : "recovery";
  const seed = parseSeed(params.get("seed"));
  const limit = parseLimit(params.get("limit"));
  const pageToken = params.get("cursor");
  const seenIds = parseSeenIds(params.get("seen"));
  const fallbackTips = getCuratedYoutubeShortTips(category, seed, MAX_LIMIT + seenIds.size)
    .filter((tip) => !seenIds.has(tip.id));

  try {
    let youtubeTips: YoutubeShortTip[] = [];
    let nextPageToken = pageToken || "";
    const searchSeenIds = new Set(seenIds);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await fetchYoutubeShorts(category, limit - youtubeTips.length, nextPageToken || null, searchSeenIds);
      youtubeTips = [...youtubeTips, ...result.tips];
      result.tips.forEach((tip) => searchSeenIds.add(tip.id));
      nextPageToken = result.nextPageToken;
      if (youtubeTips.length >= limit || !nextPageToken) break;
    }

    const existingIds = new Set(youtubeTips.map((tip) => tip.id));
    const tips = [...youtubeTips, ...fallbackTips.filter((tip) => !existingIds.has(tip.id))].slice(0, limit);

    return NextResponse.json({
      tips,
      nextCursor: nextPageToken,
      source: youtubeTips.length ? "youtube" : "curated",
      sort: "latest",
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      tips: fallbackTips.slice(0, limit),
      nextCursor: "",
      source: "curated",
      sort: "latest",
      updatedAt: new Date().toISOString(),
    });
  }
}
