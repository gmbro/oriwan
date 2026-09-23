import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

import {
  deriveAnonymousFortuneProfile,
  parseDailyFortuneInput,
  parseDailyFortuneResult,
  SAFE_DAILY_FORTUNE_FALLBACK,
  type AnonymousFortuneProfile,
  type DailyFortuneResult,
} from "@/lib/daily-fortune-contract";
import { getServiceClient } from "@/lib/admin-data";
import { resolvePersonalKakaoIdentity } from "@/lib/personal-member-context";
import { guardMutationRequest, readLimitedJson } from "@/lib/request-security";
import { toKstIsoDate } from "@/lib/run-records";
import { logServerFailure } from "@/lib/server-error-log";
import { fortuneStorage } from "@/lib/fortune-storage";

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

type FortuneCache = {
  version: 2;
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

function readFortuneCache(
  request: NextRequest,
  expected: Omit<FortuneCache, "version" | "fortune">,
  profile: AnonymousFortuneProfile,
) {
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
    const fortune = parseDailyFortuneResult(value.fortune, profile);
    return value.version === 2
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

export async function GET() {
  const identity = await resolvePersonalKakaoIdentity();
  if (!identity.ok) return json({ error: "로그인 후 확인해주세요." }, 401);
  const service = getServiceClient();
  if (!service) return json({ error: "운세 설정을 불러오지 못했어요." }, 503);
  try {
    const store = await fortuneStorage(service, identity.authUserId);
    const parsed = parseDailyFortuneInput(await store.read("profile"), toKstIsoDate());
    if (!parsed.ok) return json({ profile: null });
    const date = toKstIsoDate();
    const anonymousProfile = deriveAnonymousFortuneProfile(parsed.value);
    const key = digest(JSON.stringify(anonymousProfile));
    const fortune = parseDailyFortuneResult(await store.read(`results/${date}/${key}`), anonymousProfile);
    return json({ profile: parsed.value, result: fortune ? { date, fortune, provider: "Google Gemini", disclaimer: "재미로 가볍게 즐기는 오늘의 메시지예요. 중요한 결정의 근거로 사용하지 마세요." } : null });
  } catch { return json({ error: "운세 설정을 불러오지 못했어요. 다시 시도해주세요." }, 503); }
}

export async function POST(request: NextRequest) {
  try { return await createFortune(request); }
  catch { return json({ error: "운세를 저장하거나 불러오지 못했어요. 다시 시도해주세요." }, 503); }
}

async function createFortune(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 4 * 1024,
    rateLimit: {
      key: "daily-fortune",
      // Reopening a saved result does not generate a new fortune.
      limit: 60,
      windowMs: 60_000,
      message: "운세 요청이 잠시 몰렸어요. 잠시 후 다시 시도해주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  const identity = await resolvePersonalKakaoIdentity();
  if (!identity.ok && identity.reason === "configuration_unavailable") {
    return json({ error: "카카오 로그인 서버 설정이 아직 준비되지 않았어요." }, 503);
  }
  if (!identity.ok) {
    return json({ error: "오늘의 운세는 카카오 로그인 후 확인할 수 있어요." }, 401);
  }
  const authUserId = identity.authUserId;
  const service = getServiceClient();
  if (!service) return json({ error: "운세 저장소를 준비하고 있어요. 잠시 후 다시 확인해주세요." }, 503);
  const store = await fortuneStorage(service, authUserId);

  const parsedBody = await readLimitedJson(request, 4 * 1024);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;

  const date = toKstIsoDate(new Date());
  const parsed = parseDailyFortuneInput(body, date);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  await store.write("profile", parsed.value);

  const anonymousProfile = deriveAnonymousFortuneProfile(parsed.value);
  const cacheIdentity = {
    date,
    user_key: digest(authUserId),
    profile_key: digest(JSON.stringify(anonymousProfile)),
  };
  const resultKey = `results/${date}/${cacheIdentity.profile_key}`;
  const storedFortune = parseDailyFortuneResult(await store.read(resultKey), anonymousProfile);
  const cachedFortune = storedFortune ?? readFortuneCache(request, cacheIdentity, anonymousProfile);
  if (cachedFortune) {
    if (!storedFortune) await store.write(resultKey, cachedFortune);
    return json({
      date,
      fortune: cachedFortune,
      provider: "Google Gemini",
      disclaimer: "재미로 가볍게 즐기는 오늘의 메시지예요. 중요한 결정의 근거로 사용하지 마세요.",
    });
  }

  if (!FORTUNE_API_KEY) return json({ error: "외부 운세 연결을 준비하고 있어요. 잠시 후 다시 확인해주세요." }, 503);
  const { data: usageAllowed, error: usageError } = await service.rpc("claim_daily_fortune_usage", {
    p_auth_user_id: authUserId,
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
      contents: `오늘 날짜 ${date}를 기준으로 성인이 가볍게 즐길 한국어 오늘의 운세를 만들어주세요. 상담 경험이 풍부한 전문가가 한 사람의 하루를 차분히 정리해주듯, 따뜻하고 격려하되 과장하지 않는 해요체로 작성해주세요. 막연한 행운보다 지금 실천할 수 있는 작고 구체적인 관찰과 제안을 담아주세요.\n\n아래 값은 내용의 다양성을 위한 내부 참고값일 뿐입니다. 결과의 어떤 항목에도 값 자체나 그 종류, 입력 정보, 파생 조건을 직접 또는 간접적으로 언급하지 마세요.\n- 참고값 A: ${anonymousProfile.western_zodiac}\n- 참고값 B: ${anonymousProfile.chinese_zodiac}\n- 참고값 C: ${anonymousProfile.birth_time_band}\n- 참고값 D: ${anonymousProfile.residence_region}\n- 참고값 E: ${anonymousProfile.name_energy}\n\n별자리, 띠, 태어난 시간이나 시간대, 지역이나 권역, 이름 지표를 결과에 쓰지 마세요. 건강·법률·금융에 관한 단정, 공포를 유발하는 예언, 권위적인 명령도 하지 마세요. JSON 스키마의 모든 항목을 자연스러운 한국어로 채워주세요.`,
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
    let result: DailyFortuneResult | null = null;
    if (rawResult) {
      try {
        result = parseDailyFortuneResult(JSON.parse(rawResult), anonymousProfile);
      } catch {
        result = null;
      }
    }
    result ??= SAFE_DAILY_FORTUNE_FALLBACK;
    await store.write(resultKey, result);

    const resultResponse = json({
      date,
      fortune: result,
      provider: "Google Gemini",
      disclaimer: "재미로 가볍게 즐기는 오늘의 메시지예요. 중요한 결정의 근거로 사용하지 마세요.",
    });
    return attachFortuneCache(resultResponse, {
      version: 2,
      ...cacheIdentity,
      fortune: result,
    });
  } catch (error) {
    logServerFailure("Daily fortune provider", error instanceof Error ? new Error(error.name) : new Error("provider_error"));
    const { error: releaseError } = await service.rpc("release_daily_fortune_usage", {
      p_auth_user_id: authUserId,
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
