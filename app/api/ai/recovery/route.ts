import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

/**
 * POST /api/ai/recovery
 * 간단한 일일 리커버리 팁 (러닝 데이터 없이도 동작)
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "러너를 위한 오늘의 회복 팁을 한 줄로 짧게 알려주세요. 밝고 긍정적인 톤으로, 50자 이내로 작성해주세요. 스트레칭, 수분 보충, 수면, 영양 등 다양한 주제에서 랜덤하게 하나를 골라주세요. 따옴표나 이모지 없이 깔끔한 문장만 작성해주세요.",
      config: { temperature: 1.0 },
    });

    const tip = response.text?.trim() || "충분한 수분 섭취와 가벼운 스트레칭으로 회복을 도와주세요.";
    return NextResponse.json({ tip });
  } catch (err) {
    console.error("Recovery tip error:", err);
    return NextResponse.json({ tip: "충분한 수분 섭취와 가벼운 스트레칭으로 회복을 도와주세요." });
  }
}
