import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { findAdminUserId, findParticipantByRunnerName, getServiceClient } from "@/lib/admin-data";
import { CHALLENGE_DATE_ERROR, CHALLENGE_START_DATE, isWithinChallengeWindow } from "@/lib/challenge";
import {
  ExtractedRunBase,
  UploadedImage,
  normalizeRecordDate,
  parseDataUrl,
  parseDistanceKm,
  parseDurationText,
  parseJsonObject,
  validImage,
} from "@/lib/run-image-extraction";
import { calculatePaceSeconds } from "@/lib/run-records";
import { createClient } from "@/lib/supabase/server";

type ExtractedRun = ExtractedRunBase;

const MAX_IMAGES = 5;

async function analyzeImage(image: UploadedImage) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

  const { mimeType, base64 } = parseDataUrl(image.dataUrl);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `NRC, Garmin, Strava, Apple Fitness 또는 러닝 기록 스크린샷에서 배경/사진/앱 장식은 무시하고 텍스트와 숫자만 읽어 JSON으로 추출하세요.

이미지에 보이는 텍스트만 근거로 판단하세요. 날짜가 "5월 5일"처럼 연도 없이 보이면 ${CHALLENGE_START_DATE.slice(0, 4)}년으로 보정해 record_date를 YYYY-MM-DD로 넣으세요.
날짜가 전혀 보이지 않으면 record_date는 null, 시간이 보이지 않으면 duration_seconds는 null로 두세요.
거리 단위가 km가 아니면 km로 환산하세요. 시간은 전체 러닝 시간을 의미하며 페이스가 아닙니다.

반드시 아래 JSON 형식만 반환하세요.
{
  "record_date": "YYYY-MM-DD" | null,
  "distance_km": number | null,
  "duration_text": string | null,
  "duration_seconds": number | null,
  "pace_text": string | null,
  "source_app": string | null,
  "raw_text": string,
  "confidence_score": number,
  "notes": string | null
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  return parseJsonObject<ExtractedRun>(response.text || "{}");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const runnerName = typeof user.user_metadata?.runner_name === "string" ? user.user_metadata.runner_name.trim() : "";
  if (!runnerName) return NextResponse.json({ error: "이름을 먼저 저장해야 이미지 기록을 연결할 수 있습니다." }, { status: 400 });

  try {
    const body = await request.json();
    const targetDate = normalizeRecordDate(body.targetDate);
    const rawImages = Array.isArray(body.images) ? body.images : [];
    const images = rawImages.filter(validImage).slice(0, MAX_IMAGES);

    if (!images.length) {
      return NextResponse.json({ error: "NRC나 Garmin 같은 러닝 기록 이미지를 업로드해주세요." }, { status: 400 });
    }
    if (rawImages.length > MAX_IMAGES) {
      return NextResponse.json({ error: `개인 기록 이미지는 한 번에 ${MAX_IMAGES}장까지 업로드할 수 있습니다.` }, { status: 400 });
    }
    if (images.length !== rawImages.length) {
      return NextResponse.json({ error: "지원하지 않는 이미지 형식이거나 파일 용량이 너무 큽니다." }, { status: 400 });
    }
    if (targetDate && !isWithinChallengeWindow(targetDate)) {
      return NextResponse.json({ error: CHALLENGE_DATE_ERROR }, { status: 400 });
    }

    const service = getServiceClient();
    if (!service) return NextResponse.json({ error: "서버 환경변수가 설정되지 않았습니다." }, { status: 500 });

    const adminUserId = await findAdminUserId(service);
    if (!adminUserId) return NextResponse.json({ error: "관리자 계정을 찾지 못했습니다." }, { status: 404 });

    const participant = await findParticipantByRunnerName(service, adminUserId, runnerName);
    if (!participant) {
      return NextResponse.json({ error: "저장한 이름이 어드민 참가자명과 일치하지 않습니다." }, { status: 404 });
    }

    const results = [];

    for (const image of images) {
      const extracted = await analyzeImage(image);
      const extractedDate = normalizeRecordDate(extracted.record_date);
      const recordDate = extractedDate || targetDate;
      const dateWasFallback = !extractedDate && Boolean(targetDate);
      const distanceKm = parseDistanceKm(extracted.distance_km);
      const durationSeconds = parseDurationText(extracted.duration_seconds ?? extracted.duration_text);

      if (!recordDate) {
        return NextResponse.json({ error: "이미지에서 날짜를 찾지 못했어요. 선택한 인증일을 확인해주세요.", extracted }, { status: 422 });
      }
      if (!isWithinChallengeWindow(recordDate)) {
        return NextResponse.json({ error: CHALLENGE_DATE_ERROR, extracted }, { status: 400 });
      }
      if (!distanceKm || distanceKm <= 0 || !durationSeconds || durationSeconds <= 0) {
        return NextResponse.json({ error: "이미지에서 거리 또는 시간을 찾지 못했어요. 수동 입력으로 보완해주세요.", extracted }, { status: 422 });
      }

      const paceSeconds = calculatePaceSeconds(distanceKm, durationSeconds);
      const notes = [
        `${image.name} 이미지에서 자동 추출`,
        extracted.source_app ? `앱: ${extracted.source_app}` : null,
        dateWasFallback ? "이미지에 날짜가 없어 선택한 날짜를 적용" : null,
        extracted.notes,
      ].filter(Boolean).join(" / ");

      const { data, error: saveError } = await service
        .from("daily_run_records")
        .upsert(
          {
            user_id: adminUserId,
            participant_id: participant.id,
            record_date: recordDate,
            distance_km: distanceKm,
            duration_seconds: durationSeconds,
            pace_seconds_per_km: paceSeconds,
            source_app: extracted.source_app || "participant_image",
            status: "certified",
            confidence_score: extracted.confidence_score ?? null,
            raw_extracted_text: extracted.raw_text || null,
            notes,
          },
          { onConflict: "user_id,participant_id,record_date" }
        )
        .select("id")
        .single();

      if (saveError) throw saveError;

      results.push({
        id: data.id,
        record_date: recordDate,
        distance_km: distanceKm,
        duration_seconds: durationSeconds,
        pace_seconds_per_km: paceSeconds,
        source_app: extracted.source_app || "러닝 앱 이미지",
        confidence_score: extracted.confidence_score ?? null,
        date_was_fallback: dateWasFallback,
      });
    }

    return NextResponse.json({ success: true, participant, results });
  } catch (err) {
    console.error("Personal image analysis error:", err);
    return NextResponse.json({ error: "이미지 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
