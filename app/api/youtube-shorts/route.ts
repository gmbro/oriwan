import { NextRequest, NextResponse } from "next/server";
import {
  getCuratedYoutubeShortTips,
  isRecoveryYoutubeTipCategory,
  seededShuffle,
  tipCategoryLabels,
  youtubeThumbnailUrl,
} from "@/lib/youtube-shorts";
import type { TipCategory, YoutubeShortTip } from "@/lib/youtube-shorts";
import { guardReadRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
const SEARCH_SIZE = 25;
const MAX_SEEN_IDS = 240;
const YOUTUBE_QUERY_BATCH_SIZE = 2;

const categoryQueries: Record<TipCategory, string[]> = {
  running: ["러닝 자세 호흡 페이스 shorts"],
  stretching: [
    "러닝 전 운동 전 무릎 발목 고관절 허리 어깨 워밍업 스트레칭 shorts",
    "러닝 후 운동 후 무릎 발목 고관절 허리 어깨 쿨다운 스트레칭 shorts",
    "러닝 후 종아리 햄스트링 발바닥 폼롤러 마사지 회복 shorts",
  ],
  recovery: [
    "러닝 후 무릎 발목 고관절 허리 어깨 회복 스트레칭 shorts",
    "러닝 후 종아리 햄스트링 발바닥 폼롤러 마사지 리커버리 shorts",
    "러닝 전 운동 전 무릎 발목 고관절 허리 어깨 워밍업 스트레칭 shorts",
    "운동 후 쿨다운 스트레칭 무릎 발목 고관절 허리 어깨 회복 shorts",
    "러너 회복 루틴 무릎 발목 고관절 허리 어깨 shorts",
  ],
};

const runningContextPattern = /러닝|달리기|마라톤|러너|running|runner|run/i;
const recoveryIncludePattern = /러닝\s*후|달리기\s*후|운동\s*후|러닝\s*전|달리기\s*전|운동\s*전|워밍업|준비운동|쿨다운|회복|리커버리|스트레칭|폼롤러|종아리|햄스트링|발목|무릎|고관절|허리|어깨|목|상체|하체|발바닥|족저|피로|근막|마사지|가동성/i;
const recoveryBlockPattern = /자세교정|착지|페이스|기록\s*단축|대회\s*후기|브이로그/i;
const tagRules: { tag: string; pattern: RegExp }[] = [
  { tag: "무릎", pattern: /무릎|슬개|knee/i },
  { tag: "발목", pattern: /발목|아킬레스|ankle/i },
  { tag: "고관절", pattern: /고관절|골반|둔근|엉덩|hip|glute/i },
  { tag: "허리", pattern: /허리|요추|등\s*하부|lower\s*back/i },
  { tag: "어깨", pattern: /어깨|목|승모|상체|shoulder|neck/i },
  { tag: "종아리", pattern: /종아리|비복근|가자미근|calf/i },
  { tag: "햄스트링", pattern: /햄스트링|뒤벅지|hamstring/i },
  { tag: "발바닥", pattern: /발바닥|족저|발\s*아치|plantar/i },
  { tag: "폼롤러", pattern: /폼롤러|마사지|근막|foam/i },
  { tag: "운동전", pattern: /러닝\s*전|달리기\s*전|운동\s*전|워밍업|준비운동|동적|가동성/i },
  { tag: "운동후", pattern: /러닝\s*후|달리기\s*후|운동\s*후|쿨다운|회복|리커버리/i },
];

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

function titleSignature(value: string) {
  return value
    .replace(/#[^\s#]+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

function inferRecoveryTag(value: string, category: TipCategory) {
  const matchedRule = tagRules.find((rule) => rule.pattern.test(value));
  return matchedRule?.tag || tipCategoryLabels[category];
}

function isRecoveryRelevantTitle(value: string) {
  const normalized = value.replace(/\s+/g, " ");
  return runningContextPattern.test(normalized) && recoveryIncludePattern.test(normalized) && !recoveryBlockPattern.test(normalized);
}

async function fetchYoutubeShortsByQuery(
  category: TipCategory,
  query: string,
  limit: number,
  seenIds: Set<string>,
  seenTitleSignatures: Set<string>
) {
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_YOUTUBE_API_KEY;
  if (!apiKey) return { tips: [] as YoutubeShortTip[], nextPageToken: "" };

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("order", "date");
  searchUrl.searchParams.set("videoDuration", "short");
  searchUrl.searchParams.set("maxResults", String(SEARCH_SIZE));
  searchUrl.searchParams.set("regionCode", "KR");
  searchUrl.searchParams.set("relevanceLanguage", "ko");
  searchUrl.searchParams.set("safeSearch", "strict");
  searchUrl.searchParams.set("key", apiKey);

  const searchResponse = await fetch(searchUrl, { next: { revalidate: 600 } });
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

  const videosResponse = await fetch(videosUrl, { next: { revalidate: 600 } });
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
      .filter((item) => {
        const signature = titleSignature(sanitizeText(item.snippet?.title));
        if (!signature || seenTitleSignatures.has(signature)) return false;
        seenTitleSignatures.add(signature);
        return true;
      })
      .map((item): YoutubeShortTip => {
        const id = item.id || "";
        const title = sanitizeText(item.snippet?.title);
        return {
          id,
          title: title || `${tipCategoryLabels[category]} 쇼츠`,
          channel: sanitizeText(item.snippet?.channelTitle) || "YouTube Shorts",
          category,
          tag: inferRecoveryTag(title, category),
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
    nextPageToken: "",
  };
}

async function fetchYoutubeShorts(category: TipCategory, limit: number, seed: number, seenIds: Set<string>) {
  const queries = seededShuffle(categoryQueries[category], seed).slice(0, YOUTUBE_QUERY_BATCH_SIZE);
  const seenTitleSignatures = new Set<string>();
  const tips: YoutubeShortTip[] = [];
  const searchSeenIds = new Set(seenIds);

  for (const query of queries) {
    if (tips.length >= limit) break;
    const result = await fetchYoutubeShortsByQuery(category, query, limit - tips.length, searchSeenIds, seenTitleSignatures);
    result.tips.forEach((tip) => {
      searchSeenIds.add(tip.id);
      tips.push(tip);
    });
  }

  return {
    tips: tips.slice(0, limit),
    nextPageToken: "",
  };
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: {
      key: "youtube-shorts-read",
      limit: 30,
      windowMs: 60_000,
      message: "추천 영상을 잠시 후 다시 불러와주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  const params = request.nextUrl.searchParams;
  const requestedCategory = params.get("category");
  const category: TipCategory = isRecoveryYoutubeTipCategory(requestedCategory) ? requestedCategory : "recovery";
  const seed = parseSeed(params.get("seed"));
  const limit = parseLimit(params.get("limit"));
  const cursorSeed = parseSeed(params.get("cursor"));
  const seenIds = parseSeenIds(params.get("seen"));
  const fallbackTips = getCuratedYoutubeShortTips(category, seed, MAX_LIMIT + seenIds.size)
    .filter((tip) => !seenIds.has(tip.id));

  try {
    const result = await fetchYoutubeShorts(category, limit, seed + cursorSeed, seenIds);
    const youtubeTips = result.tips;

    const existingIds = new Set(youtubeTips.map((tip) => tip.id));
    const existingTitleSignatures = new Set(youtubeTips.map((tip) => titleSignature(tip.title)).filter(Boolean));
    const tips = [
      ...youtubeTips,
      ...fallbackTips.filter((tip) => {
        const signature = titleSignature(tip.title);
        return !existingIds.has(tip.id) && (!signature || !existingTitleSignatures.has(signature));
      }),
    ].slice(0, limit);

    return NextResponse.json({
      tips,
      nextCursor: "",
      source: youtubeTips.length ? "youtube" : "curated",
      sort: "latest",
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return NextResponse.json({
      tips: fallbackTips.slice(0, limit),
      nextCursor: "",
      source: "curated",
      sort: "latest",
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" } });
  }
}
