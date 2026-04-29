import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

const fallbackTips = [
  "오늘의 회복은 천천히 시작해도 충분해요.\n종아리와 햄스트링을 30초씩 부드럽게 늘려주세요.",
  "달린 몸에는 물과 시간이 필요해요.\n물 한 컵을 먼저 마시고 발목을 가볍게 돌려주세요.",
  "회복도 다음 러닝을 위한 훈련이에요.\n허벅지 앞쪽과 고관절을 1분씩 풀어주세요.",
  "근육이 무겁다면 강도보다 순서가 중요해요.\n가벼운 걷기 5분 뒤 하체 스트레칭을 해보세요.",
  "오늘은 몸의 긴장을 낮추는 날로 잡아도 좋아요.\n깊게 호흡하며 폼롤러를 천천히 굴려주세요.",
  "러닝 후 뻐근함은 작은 관리로 줄어들어요.\n발바닥을 공이나 손으로 1분 정도 마사지해주세요.",
  "좋은 회복은 과하게 하지 않는 데서 시작해요.\n통증 없는 범위에서 엉덩이와 종아리를 풀어주세요.",
];

function pickFallbackTip(seed: string) {
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return fallbackTips[hash % fallbackTips.length];
}

function normalizeTip(tip: string) {
  return tip.replace(/\s+/g, " ").trim();
}

function pickDifferentFallbackTip(seed: string, previousTip: string) {
  const previous = normalizeTip(previousTip);
  const startIndex = fallbackTips.indexOf(pickFallbackTip(seed));

  for (let offset = 0; offset < fallbackTips.length; offset += 1) {
    const candidate = fallbackTips[(startIndex + offset) % fallbackTips.length];
    if (normalizeTip(candidate) !== previous) return candidate;
  }

  return fallbackTips[0];
}

/**
 * POST /api/ai/recovery
 * 간단한 일일 리커버리 팁 (러닝 데이터 없이도 동작)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const date = typeof body.date === "string" ? body.date : new Date().toISOString().slice(0, 10);
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "daily";
  const previousTip = typeof body.previousTip === "string" ? body.previousTip.trim() : "";
  const fallbackTip = pickDifferentFallbackTip(`${date}:${refreshToken}`, previousTip);

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `러너를 위한 오늘의 회복 팁을 작성해주세요.

조건:
- 기준 날짜: ${date}
- 변화 시드: ${refreshToken}
- 모바일 가독성을 위해 반드시 2~3줄로 나누기
- 첫 줄은 짧은 회복 관점, 다음 줄은 구체적 액션
- 따옴표나 이모지 없이 깔끔하게 작성
- 매번 같은 문장을 반복하지 말고 스트레칭, 수분, 수면, 마사지, 호흡, 걷기 중 초점을 바꿔 작성
${previousTip ? `- 직전 팁과 다른 내용으로 작성. 직전 팁: ${previousTip}` : ""}`,
      config: { temperature: 1.2 },
    });

    const generatedTip = response.text?.trim() || "";
    const tip = generatedTip && normalizeTip(generatedTip) !== normalizeTip(previousTip)
      ? generatedTip
      : fallbackTip;
    return NextResponse.json({ tip });
  } catch (err) {
    console.error("Recovery tip error:", err);
    return NextResponse.json({ tip: fallbackTip });
  }
}
