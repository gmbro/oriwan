import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";

/**
 * POST /api/ai/recovery-tip
 *
 * Gemini API를 사용하여 실제 러닝 데이터 기반 맞춤형 회복 팁을 생성합니다.
 * ⚠️ Gemini API 키는 서버에서만 사용되며 클라이언트에 노출되지 않습니다.
 */
export async function POST(request: NextRequest) {
  // 인증 확인
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("oriwan_session")?.value;

  if (!sessionCookie) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const { runData } = await request.json();

    if (!runData) {
      return NextResponse.json(
        { error: "러닝 데이터가 필요합니다." },
        { status: 400 }
      );
    }

    const distanceKm = (runData.distance / 1000).toFixed(2);
    const movingMinutes = Math.floor(runData.moving_time / 60);
    const paceMinPerKm = (runData.moving_time / 60 / (runData.distance / 1000)).toFixed(1);

    const prompt = `당신은 러닝 전문 스포츠 트레이너입니다. 다음 러닝 데이터를 분석하고, 한국어로 짧고 실용적인 회복 팁을 제공해주세요.

## 오늘의 러닝 데이터
- 거리: ${distanceKm}km
- 시간: ${movingMinutes}분
- 평균 페이스: ${paceMinPerKm}분/km
${runData.average_cadence ? `- 평균 케이던스: ${runData.average_cadence} spm` : ""}
${runData.average_heartrate ? `- 평균 심박수: ${runData.average_heartrate} bpm` : ""}
${runData.total_elevation_gain ? `- 총 고도 상승: ${runData.total_elevation_gain}m` : ""}

## 응답 형식 (반드시 아래 JSON 형식으로)
{
  "summary": "오늘 러닝에 대한 한 줄 요약 (예: 좋은 페이스로 5km를 완주했어요!)",
  "muscle_focus": "오늘 가장 많이 사용한 근육 부위 (예: 종아리, 장경인대)",
  "stretches": [
    {"name": "스트레칭 이름", "duration": "30초", "description": "간단한 방법 설명"}
  ],
  "hydration_tip": "수분 보충 팁 한 줄",
  "encouragement": "격려/응원 한 줄"
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
    return NextResponse.json(
      { error: "AI 회복 팁 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
