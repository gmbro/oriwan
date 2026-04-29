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
        contents: "러너를 위한 오늘의 회복 팁을 작성해주세요. 모바일 가독성을 위해 반드시 2~3줄로 나누어 적어주세요. (예: 첫 줄은 동기부여, 다음 줄은 구체적 액션). 따옴표나 이모지 없이 깔끔하게 작성해주세요.",
        config: { temperature: 1.0 },
      });
  
      const tip = response.text?.trim() || "가벼운 스트레칭과\n충분한 수분 보충으로\n회복을 도와주세요.";
    return NextResponse.json({ tip });
  } catch (err) {
    console.error("Recovery tip error:", err);
    return NextResponse.json({ tip: "충분한 수분 섭취와 가벼운 스트레칭으로 회복을 도와주세요." });
  }
}
