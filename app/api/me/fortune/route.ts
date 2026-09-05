import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

import {
  deriveAnonymousFortuneProfile,
  parseDailyFortuneInput,
  type DailyFortuneResult,
} from "@/lib/daily-fortune-contract";
import { getServiceClient } from "@/lib/admin-data";
import { guardMutationRequest } from "@/lib/request-security";
import { toKstIsoDate } from "@/lib/run-records";
import { logServerFailure } from "@/lib/server-error-log";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FORTUNE_MODEL = process.env.GEMINI_FORTUNE_MODEL || "gemini-3.1-flash-lite";
const FORTUNE_API_KEY = process.env.GEMINI_FORTUNE_API_KEY || process.env.GEMINI_API_KEY || "";
const FORTUNE_CACHE_COOKIE = "twtt_daily_fortune";
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

const FORTUNE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    message: { type: Type.STRING },
    keyword: { type: Type.STRING },
    action: { type: Type.STRING },
    relationship: { type: Type.STRING },
    work: { type: Type.STRING },
  },
  required: ["title", "message", "keyword", "action", "relationship", "work"],
  propertyOrdering: ["title", "message", "keyword", "action", "relationship", "work"],
} as const;

function json(payload: object, status = 200) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}

function hasKakaoIdentity(user: { app_metadata?: Record<string, unknown>; identities?: Array<{ provider?: string }> }) {
  return user.app_metadata?.provider === "kakao"
    || Boolean(user.identities?.some((identity) => identity.provider === "kakao"));
}

function normalizeResultText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function parseProviderResult(value: unknown): DailyFortuneResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const title = normalizeResultText(record.title, 48);
  const message = normalizeResultText(record.message, 240);
  const keyword = normalizeResultText(record.keyword, 20);
  const action = normalizeResultText(record.action, 100);
  const relationship = normalizeResultText(record.relationship, 120);
  const work = normalizeResultText(record.work, 120);
  return title && message && keyword && action && relationship && work
    ? { title, message, keyword, action, relationship, work }
    : null;
}

type FortuneCache = {
  version: 1;
  date: string;
  user_key: string;
  profile_key: string;
  fortune: DailyFortuneResult;
};

function digest(value: string, length = 24) {
  return createHash("sha256").update(value).digest("base64url").slice(0, length);
}

function cacheSecret() {
  return process.env.DAILY_FORTUNE_SECRET || FORTUNE_API_KEY;
}

function signCache(encoded: string, secret: string) {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

function readFortuneCache(request: NextRequest, expected: Omit<FortuneCache, "version" | "fortune">) {
  const secret = cacheSecret();
  const cookie = request.cookies.get(FORTUNE_CACHE_COOKIE)?.value || "";
  const separator = cookie.lastIndexOf(".");
  if (!secret || separator <= 0 || cookie.length > 3_800) return null;

  const encoded = cookie.slice(0, separator);
  const signature = cookie.slice(separator + 1);
  const expectedSignature = signCache(encoded, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<FortuneCache>;
    const fortune = parseProviderResult(value.fortune);
    return value.version === 1
      && value.date === expected.date
      && value.user_key === expected.user_key
      && value.profile_key === expected.profile_key
      && fortune
      ? fortune
      : null;
  } catch {
    return null;
  }
}

function attachFortuneCache(response: NextResponse, value: FortuneCache) {
  const secret = cacheSecret();
  if (!secret) return response;
  const encoded = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  response.cookies.set(FORTUNE_CACHE_COOKIE, `${encoded}.${signCache(encoded, secret)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/me/fortune",
    maxAge: 2 * 24 * 60 * 60,
  });
  return response;
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 4 * 1024,
    rateLimit: {
      key: "daily-fortune",
      limit: 3,
      windowMs: 60_000,
      message: "운세 요청이 잠시 몰렸어요. 잠시 후 다시 시도해주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return json({ error: "카카오 로그인 서버 설정이 아직 준비되지 않았어요." }, 503);
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !hasKakaoIdentity(user)) {
    return json({ error: "오늘의 운세는 카카오 로그인 후 확인할 수 있어요." }, 401);
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 4 * 1024) {
      return json({ error: "입력 내용이 너무 길어요." }, 413);
    }
  } catch {
    return json({ error: "입력 내용을 확인할 수 없어요." }, 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "입력 형식을 다시 확인해주세요." }, 400);
  }

  const date = toKstIsoDate(new Date());
  const parsed = parseDailyFortuneInput(body, date);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  if (!FORTUNE_API_KEY) {
    return json({ error: "외부 운세 연결을 준비하고 있어요. 잠시 후 다시 확인해주세요." }, 503);
  }

  const anonymousProfile = deriveAnonymousFortuneProfile(parsed.value);
  const cacheIdentity = {
    date,
    user_key: digest(user.id),
    profile_key: digest(JSON.stringify(anonymousProfile)),
  };
  const cachedFortune = readFortuneCache(request, cacheIdentity);
  if (cachedFortune) {
    return json({
      date,
      fortune: cachedFortune,
      provider: "Google Gemini",
      disclaimer: "재미로 가볍게 즐기는 오늘의 메시지예요. 중요한 결정의 근거로 사용하지 마세요.",
    });
  }

  const service = getServiceClient();
  if (!service) {
    return json({ error: "운영 운세 사용량 확인을 준비하고 있어요. 잠시 후 다시 확인해주세요." }, 503);
  }
  const { data: usageAllowed, error: usageError } = await service.rpc("claim_daily_fortune_usage", {
    p_auth_user_id: user.id,
    p_fortune_date: date,
    p_daily_limit: 3,
  });
  if (usageError) {
    logServerFailure("Daily fortune usage", new Error(usageError.code || "usage_error"));
    return json({ error: "운영 운세 사용량 확인을 준비하고 있어요. 잠시 후 다시 확인해주세요." }, 503);
  }
  if (usageAllowed !== true) {
    return json({ error: "오늘의 운세는 하루 세 번까지 새로 만들 수 있어요. 내일 다시 확인해주세요." }, 429);
  }

  const seed = createHash("sha256")
    .update(JSON.stringify({ date, ...anonymousProfile }))
    .digest()
    .readUInt32BE(0) & 0x7fffffff;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const ai = new GoogleGenAI({ apiKey: FORTUNE_API_KEY });
    const response = await ai.models.generateContent({
      model: FORTUNE_MODEL,
      contents: `오늘 날짜 ${date}를 기준으로 성인 사용자가 가볍게 즐길 한국어 오늘의 운세를 만들어주세요.\n\n비식별 운세 조건:\n- 별자리: ${anonymousProfile.western_zodiac}\n- 띠: ${anonymousProfile.chinese_zodiac}\n- 출생 시간대: ${anonymousProfile.birth_time_band}\n- 생활 권역: ${anonymousProfile.residence_region}\n- 이름 수리 지표: ${anonymousProfile.name_energy}\n\n건강·법률·금융에 관한 단정이나 공포를 유발하는 예언은 하지 마세요. 구체적이되 일상에서 안전하게 실천할 수 있는 긍정적인 제안으로 작성하고, JSON 스키마의 모든 항목을 한국어로 채워주세요.`,
      config: {
        abortSignal: controller.signal,
        httpOptions: { timeout: 12_000 },
        responseMimeType: "application/json",
        responseSchema: FORTUNE_RESPONSE_SCHEMA,
        temperature: 0.75,
        maxOutputTokens: 520,
        seed,
      },
    });
    const rawResult = response.text;
    const result = rawResult ? parseProviderResult(JSON.parse(rawResult)) : null;
    if (!result) throw new Error("invalid_fortune_response");

    const resultResponse = json({
      date,
      fortune: result,
      provider: "Google Gemini",
      disclaimer: "재미로 가볍게 즐기는 오늘의 메시지예요. 중요한 결정의 근거로 사용하지 마세요.",
    });
    return attachFortuneCache(resultResponse, {
      version: 1,
      ...cacheIdentity,
      fortune: result,
    });
  } catch (error) {
    logServerFailure("Daily fortune provider", error instanceof Error ? new Error(error.name) : new Error("provider_error"));
    const { error: releaseError } = await service.rpc("release_daily_fortune_usage", {
      p_auth_user_id: user.id,
      p_fortune_date: date,
    });
    if (releaseError) {
      logServerFailure("Daily fortune usage release", new Error(releaseError.code || "usage_release_error"));
    }
    return json({ error: "오늘의 운세를 만들지 못했어요. 잠시 후 다시 시도해주세요." }, 503);
  } finally {
    clearTimeout(timeout);
  }
}
