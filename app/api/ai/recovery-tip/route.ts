import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

/**
 * POST /api/ai/recovery-tip
 *
 * Gemini 2.0 Flash (가장 빠른 모델)로 맞춤형 회복 팁 + 유튜브 영상 추천을 생성합니다.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { runData } = await request.json();

    if (!runData) {
      return NextResponse.json({ error: "러닝 데이터가 필요합니다." }, { status: 400 });
    }

    const distanceKm = (runData.distance / 1000).toFixed(2);
    const movingMinutes = Math.floor(runData.moving_time / 60);
    const paceMinPerKm = (runData.moving_time / 60 / (runData.distance / 1000)).toFixed(1);

    const prompt = `당신은 러닝 전문 스포츠 트레이너입니다. 다음 러닝 데이터를 분석하고, 한국어로 짧고 실용적인 회복 팁을 제공해주세요. 밝고 긍정적이며 격려하는 톤으로 작성해주세요!

## 오늘의 러닝 데이터
- 거리: ${distanceKm}km
- 시간: ${movingMinutes}분
- 평균 페이스: ${paceMinPerKm}분/km
${runData.average_cadence ? `- 평균 케이던스: ${runData.average_cadence} spm` : ""}
${runData.average_heartrate ? `- 평균 심박수: ${runData.average_heartrate} bpm` : ""}
${runData.total_elevation_gain ? `- 총 고도 상승: ${runData.total_elevation_gain}m` : ""}

## 응답 형식 (반드시 아래 JSON 형식으로)
{
  "summary": "오늘 러닝에 대한 밝고 긍정적인 한 줄 요약 (예: 좋은 페이스로 5km를 멋지게 완주했어요! 💪)",
  "muscle_focus": "오늘 가장 많이 사용한 근육 부위 (예: 종아리, 장경인대)",
  "stretches": [
    {"name": "스트레칭 이름", "duration": "30초", "description": "간단한 방법 설명"}
  ],
  "youtube_videos": [
    {"title": "영상 제목 (한국어)", "search_query": "유튜브 검색어 (한국어, 이 데이터에 맞는 스트레칭 영상을 찾을 수 있는 구체적인 검색어)", "reason": "추천 이유 한 줄"}
  ],
  "hydration_tip": "수분 보충 팁 한 줄 (긍정적 톤)",
  "encouragement": "격려/응원 한 줄 (따뜻하고 힘이 되는 말)"
}

youtube_videos는 2~3개를 추천해주세요. 검색어는 "러닝 후 종아리 스트레칭" 처럼 구체적이어야 합니다.`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const text = response.text ?? "";
    const tip = JSON.parse(text);

    return NextResponse.json({ tip });
  } catch (err) {
    console.error("Gemini API error:", err);
    return NextResponse.json({ error: "AI 회복 팁 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
