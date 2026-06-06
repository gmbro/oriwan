import { Type, type GenerateContentConfig } from "@google/genai";

export const GEMINI_OCR_MODEL = process.env.GEMINI_OCR_MODEL || "gemini-3.5-flash";

const GEMINI_OCR_MODEL_FALLBACKS = [
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.0-flash",
];

const GEMINI_OCR_MODEL_ALIASES: Record<string, string> = {
  "gemini-3.1-flash": "gemini-2.5-flash",
  "gemini-3-flash": "gemini-3-flash-preview",
};

function normalizeGeminiOcrModel(model: string) {
  return GEMINI_OCR_MODEL_ALIASES[model] || model;
}

export function resolveGeminiOcrModels() {
  const configuredFallbacks = (process.env.GEMINI_OCR_MODEL_FALLBACKS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return Array.from(new Set([
    GEMINI_OCR_MODEL,
    ...configuredFallbacks,
    ...GEMINI_OCR_MODEL_FALLBACKS,
  ].filter(Boolean).map(normalizeGeminiOcrModel)));
}

export const GEMINI_OCR_CONFIG: GenerateContentConfig = {
  responseMimeType: "application/json",
  temperature: 0.1,
  maxOutputTokens: 1200,
};

export const RUN_IMAGE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    participant_name: { type: Type.STRING, nullable: true },
    record_date: { type: Type.STRING, nullable: true, description: "YYYY-MM-DD format" },
    distance_km: { type: Type.NUMBER, nullable: true },
    duration_text: { type: Type.STRING, nullable: true },
    duration_seconds: { type: Type.INTEGER, nullable: true },
    pace_text: { type: Type.STRING, nullable: true },
    source_app: { type: Type.STRING, nullable: true },
    raw_text: { type: Type.STRING },
    confidence_score: { type: Type.NUMBER },
    notes: { type: Type.STRING, nullable: true },
  },
  required: [
    "record_date",
    "distance_km",
    "duration_text",
    "duration_seconds",
    "pace_text",
    "source_app",
    "raw_text",
    "confidence_score",
    "notes",
  ],
  propertyOrdering: [
    "participant_name",
    "record_date",
    "distance_km",
    "duration_text",
    "duration_seconds",
    "pace_text",
    "source_app",
    "raw_text",
    "confidence_score",
    "notes",
  ],
} as const;

export function buildRunImagePrompt(input: {
  challengeYear: string;
  targetDate?: string | null;
  knownNames?: string[];
  includeParticipantName?: boolean;
}) {
  const knownNames = input.knownNames?.filter(Boolean) || [];
  const targetDateGuide = input.targetDate
    ? `선택된 기준 날짜는 ${input.targetDate}입니다. 이미지에 "오늘", "어제", "수요일"처럼 상대 날짜만 보이거나 날짜가 전혀 없으면 record_date에 이 기준 날짜를 사용하세요.`
    : "선택된 기준 날짜가 없습니다. 이미지에 날짜가 전혀 없으면 record_date는 null로 두세요.";
  const participantGuide = input.includeParticipantName
    ? `참가자 이름은 아래 등록된 이름 중 이미지에서 보이는 값과 가장 가까운 것을 participant_name에 넣고, 확실하지 않으면 null로 두세요.\n등록된 참가자: ${knownNames.length ? knownNames.join(", ") : "없음"}`
    : "참가자 이름은 추출하지 않아도 됩니다. participant_name은 null로 두세요.";

  return `러닝 기록 스크린샷에서 배경/사진/앱 장식은 무시하고 텍스트와 숫자만 읽어 JSON으로 추출하세요.

이미지에 보이는 텍스트와 사용자가 선택한 기준 날짜만 근거로 판단하세요.
${targetDateGuide}
연도 없이 "5월 5일"처럼 보이면 ${input.challengeYear}년으로 보정해 record_date를 YYYY-MM-DD로 넣으세요.
거리 단위가 km가 아니면 km로 환산하세요. 예: "8.50 킬로미터"는 distance_km 8.5입니다.
시간은 전체 러닝 시간, 운동 시간, 총 시간을 의미합니다. 예: "1:00:21 시간"은 duration_text "1:00:21", duration_seconds 3621입니다.
평균 페이스는 duration으로 쓰지 마세요. 예: "7'06'' 평균 페이스"는 pace_text로만 넣으세요.
칼로리, 고도 상승, 심박수, 케이던스는 거리나 시간으로 쓰지 마세요.
${participantGuide}

앱 이름은 화면에서 추론할 수 있으면 source_app에 넣으세요. 예: Nike Run Club, Garmin, Strava, Apple Fitness.
반드시 스키마에 맞는 JSON 객체만 반환하세요.`;
}

export function getGeminiErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  if (isGeminiBillingError(error)) {
    return "OCR 서버 크레딧이 소진됐어요. Google AI Studio 결제/크레딧을 충전하거나 새 Gemini API 키로 교체해야 이미지 인식이 다시 작동합니다.";
  }
  if (normalized.includes("free_tier") || normalized.includes("free tier")) {
    return "현재 Gemini API 키가 무료 티어 quota로 처리되고 있어요. Vercel의 GEMINI_API_KEY가 결제 완료된 프로젝트의 키인지 확인해주세요.";
  }
  if (message.includes("RESOURCE_EXHAUSTED") || normalized.includes("quota") || normalized.includes("rate limit")) {
    return "OCR 요청 한도가 잠시 꽉 찼어요. 잠시 후 다시 시도하거나 GEMINI_OCR_MODEL_FALLBACKS에 더 가벼운 모델을 추가해주세요.";
  }
  if (message.includes("NOT_FOUND") || message.includes("404") || message.includes("not found")) {
    return "OCR 모델명이 현재 Gemini API에서 지원되지 않아요. 잠시 후 다시 시도하거나 GEMINI_OCR_MODEL 설정을 확인해주세요.";
  }
  if (message.includes("API key") || message.includes("GEMINI_API_KEY")) {
    return "OCR 서버 키가 아직 설정되지 않았어요. 환경변수를 확인해주세요.";
  }
  return "이미지 글자를 읽지 못했어요. 화면이 선명한지 한 번만 확인해주세요.";
}

export function getGeminiErrorDebug(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown OCR error");
  return message.replace(/\s+/g, " ").slice(0, 500);
}

export function isGeminiBillingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("prepayment credits are depleted") ||
    normalized.includes("billing is not enabled") ||
    normalized.includes("billing account is not configured") ||
    normalized.includes("project has no billing account") ||
    normalized.includes("payment required")
  );
}
