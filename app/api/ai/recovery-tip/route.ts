import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

/**
 * POST /api/ai/recovery-tip
 * Strava 러닝 데이터 기반 맞춤형 회복 팁 + 사진 인증 미션 생성
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

    const prompt = `당신은 러닝 전문 스포츠 트레이너입니다. 다음 러닝 데이터를 분석하여 회복 팁과 사진 인증 미션을 생성해주세요.

## 오늘의 러닝 데이터
- 거리: ${distanceKm}km
- 시간: ${movingMinutes}분
- 평균 페이스: ${paceMinPerKm}분/km
${runData.average_cadence ? `- 평균 케이던스: ${runData.average_cadence} spm` : ""}
${runData.average_heartrate ? `- 평균 심박수: ${runData.average_heartrate} bpm` : ""}
${runData.max_heartrate ? `- 최대 심박수: ${runData.max_heartrate} bpm` : ""}
${runData.total_elevation_gain ? `- 총 고도 상승: ${runData.total_elevation_gain}m` : ""}
${runData.calories ? `- 소모 칼로리: ${runData.calories}kcal` : ""}

## 반드시 지킬 응답 규칙
1. summary: 오늘 러닝 데이터를 보고 현황과 변화를 있는 그대로 객관적으로 한 줄 설명. 무조건 "향상되었다", "좋아졌다" 같은 판단을 하지 말 것. 예: "오늘 5.3km를 평균 심박 155bpm으로 뛰었습니다."
2. muscle_focus: 이 러닝 패턴에서 피로가 쌓일 가능성이 높은 근육 부위 1~2개 (예: "종아리, 대퇴사두근")
3. mission_title: 사진 인증 미션 제목 (예: "종아리 마사지 인증 📸")
4. mission_guide: 반드시 "한 손으로 촬영이 가능한" 구체적인 자세를 묘사. 거울 앞에서 후면 카메라로 찍는 상황. 2문장 이내. (예: "바닥에 앉아서 한 손으로 종아리를 꾹꾹 누르는 모습을 거울에 비춰 찍어주세요.")
5. stretches: 추천 스트레칭 3개 (name, duration, description)
6. hydration_tip: 수분 보충 관련 실용적 팁 한 줄
7. encouragement: 따뜻한 응원 한 줄

## 응답 형식 (반드시 JSON)
{
  "summary": "",
  "muscle_focus": "",
  "mission_title": "",
  "mission_guide": "",
  "stretches": [{"name": "", "duration": "", "description": ""}],
  "hydration_tip": "",
  "encouragement": ""
}`;

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
    return NextResponse.json({ error: "AI 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
