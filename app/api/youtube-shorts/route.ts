import { NextRequest, NextResponse } from "next/server";
import {
  getCuratedYoutubeShortTips,
  isTipCategory,
  seededShuffle,
  tipCategoryLabels,
  youtubeThumbnailUrl,
} from "@/lib/youtube-shorts";
import type { TipCategory, YoutubeShortTip } from "@/lib/youtube-shorts";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 12;
const SEARCH_SIZE = 25;

const categoryQueries: Record<TipCategory, string> = {
  running: "러닝 자세 초보 러너 팁 shorts",
  stretching: "러닝 전 스트레칭 워밍업 shorts",
  recovery: "러닝 후 회복 리커버리 스트레칭 shorts",
};

type YoutubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
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

async function fetchYoutubeShorts(category: TipCategory, seed: number, limit: number) {
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", categoryQueries[category]);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("videoDuration", "short");
  searchUrl.searchParams.set("maxResults", String(SEARCH_SIZE));
  searchUrl.searchParams.set("regionCode", "KR");
  searchUrl.searchParams.set("relevanceLanguage", "ko");
  searchUrl.searchParams.set("safeSearch", "strict");
  searchUrl.searchParams.set("key", apiKey);

  const searchResponse = await fetch(searchUrl, { next: { revalidate: 60 * 60 * 6 } });
  if (!searchResponse.ok) return [];

  const searchJson = (await searchResponse.json()) as { items?: YoutubeSearchItem[] };
  const ids = Array.from(
    new Set((searchJson.items || []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id)))
  );
  if (!ids.length) return [];

  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("part", "snippet,contentDetails,status");
  videosUrl.searchParams.set("id", ids.join(","));
  videosUrl.searchParams.set("key", apiKey);

  const videosResponse = await fetch(videosUrl, { next: { revalidate: 60 * 60 * 6 } });
  if (!videosResponse.ok) return [];

  const videosJson = (await videosResponse.json()) as { items?: YoutubeVideoItem[] };

  return seededShuffle(
    (videosJson.items || [])
      .filter((item) => item.id)
      .filter((item) => item.status?.embeddable !== false)
      .filter((item) => parseIsoDurationSeconds(item.contentDetails?.duration) <= 120)
      .map((item): YoutubeShortTip => {
        const id = item.id || "";
        return {
          id,
          title: sanitizeText(item.snippet?.title) || `${tipCategoryLabels[category]} 쇼츠`,
          channel: sanitizeText(item.snippet?.channelTitle) || "YouTube Shorts",
          category,
          tag: tipCategoryLabels[category],
          thumbnailUrl:
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            youtubeThumbnailUrl(id),
        };
      }),
    seed
  ).slice(0, limit);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requestedCategory = params.get("category");
  const category: TipCategory = isTipCategory(requestedCategory) ? requestedCategory : "running";
  const seed = parseSeed(params.get("seed"));
  const limit = parseLimit(params.get("limit"));
  const fallbackTips = getCuratedYoutubeShortTips(category, seed, MAX_LIMIT);

  try {
    const youtubeTips = await fetchYoutubeShorts(category, seed, limit);
    const existingIds = new Set(youtubeTips.map((tip) => tip.id));
    const tips = [...youtubeTips, ...fallbackTips.filter((tip) => !existingIds.has(tip.id))].slice(0, limit);

    return NextResponse.json({
      tips,
      source: youtubeTips.length ? "youtube" : "curated",
    });
  } catch {
    return NextResponse.json({
      tips: fallbackTips.slice(0, limit),
      source: "curated",
    });
  }
}
