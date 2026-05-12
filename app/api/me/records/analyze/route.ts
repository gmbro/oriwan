import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { findAdminUserId, findParticipantByRunnerName, getServiceClient } from "@/lib/admin-data";
import { CHALLENGE_DATE_ERROR, CHALLENGE_START_DATE, isWithinChallengeWindow } from "@/lib/challenge";
import { GEMINI_OCR_MODEL, RUN_IMAGE_RESPONSE_SCHEMA, buildRunImagePrompt, getGeminiErrorDebug, getGeminiErrorMessage } from "@/lib/gemini";
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
import { guardMutationRequest } from "@/lib/request-security";

type ExtractedRun = ExtractedRunBase;

const MAX_IMAGES = 5;
const MAX_BODY_BYTES = MAX_IMAGES * 4 * 1024 * 1024 + 512 * 1024;

type AnalyzeFailure = {
  file_name: string;
  error: string;
  extracted?: ExtractedRun;
};

async function analyzeImage(image: UploadedImage, targetDate?: string | null) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

  const { mimeType, base64 } = parseDataUrl(image.dataUrl);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = buildRunImagePrompt({
    challengeYear: CHALLENGE_START_DATE.slice(0, 4),
    targetDate,
  });

  const response = await ai.models.generateContent({
    model: GEMINI_OCR_MODEL,
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
      responseSchema: RUN_IMAGE_RESPONSE_SCHEMA,
      temperature: 0.1,
    },
  });

  return parseJsonObject<ExtractedRun>(response.text || "{}");
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: MAX_BODY_BYTES,
    rateLimit: {
      key: "personal-image-analysis",
      limit: 12,
      windowMs: 60_000,
    },
  });
  if (guardResponse) return guardResponse;

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "이미지 기록을 올리려면 먼저 로그인해주세요." }, { status: 401 });

  const runnerName = typeof user.user_metadata?.runner_name === "string" ? user.user_metadata.runner_name.trim() : "";
  if (!runnerName) return NextResponse.json({ error: "이름을 먼저 연결하면 이미지 기록도 바로 이어져요." }, { status: 400 });

  try {
    const body = await request.json();
    const targetDate = normalizeRecordDate(body.targetDate);
    const rawImages = Array.isArray(body.images) ? body.images : [];
    const images = rawImages.filter(validImage).slice(0, MAX_IMAGES);

    if (!images.length) {
      return NextResponse.json({ error: "NRC나 Garmin 같은 러닝 기록 이미지를 올려주세요." }, { status: 400 });
    }
    if (rawImages.length > MAX_IMAGES) {
      return NextResponse.json({ error: `개인 기록 이미지는 한 번에 ${MAX_IMAGES}장까지 올릴 수 있어요.` }, { status: 400 });
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
      return NextResponse.json({ error: "저장한 이름이 어드민의 멤버 이름과 달라요. 띄어쓰기까지 맞춰주세요." }, { status: 404 });
    }

    const results = [];
    const failed: AnalyzeFailure[] = [];

    for (const image of images) {
      let extracted: ExtractedRun;
      try {
        extracted = await analyzeImage(image, targetDate);
      } catch (error) {
        console.warn("Personal OCR image analysis failed", {
          model: GEMINI_OCR_MODEL,
          file: image.name,
          error: getGeminiErrorDebug(error),
        });
        failed.push({ file_name: image.name, error: getGeminiErrorMessage(error) });
        continue;
      }

      const extractedDate = normalizeRecordDate(extracted.record_date);
      const recordDate = extractedDate || targetDate;
      const dateWasFallback = !extractedDate && Boolean(targetDate);
      const distanceKm = parseDistanceKm(extracted.distance_km);
      const durationSeconds = parseDurationText(extracted.duration_seconds ?? extracted.duration_text);

      if (!recordDate) {
        failed.push({ file_name: image.name, error: "이미지에서 날짜를 찾지 못했어요. 날짜 없는 이미지는 선택일 적용을 켜주세요.", extracted });
        continue;
      }
      if (!isWithinChallengeWindow(recordDate)) {
        failed.push({ file_name: image.name, error: CHALLENGE_DATE_ERROR, extracted });
        continue;
      }
      if ((!distanceKm || distanceKm <= 0) && (!durationSeconds || durationSeconds <= 0)) {
        failed.push({ file_name: image.name, error: "이미지에서 거리와 시간을 찾지 못했어요. 직접 입력으로 가볍게 보완해주세요.", extracted });
        continue;
      }

      const paceSeconds = calculatePaceSeconds(distanceKm, durationSeconds);
      const notes = [
        `${image.name} 이미지에서 자동 추출`,
        extracted.source_app ? `앱: ${extracted.source_app}` : null,
        dateWasFallback ? "이미지에 날짜가 없어 선택한 날짜를 적용" : null,
        !distanceKm ? "거리는 나중에 보완 가능" : null,
        !durationSeconds ? "시간은 나중에 보완 가능" : null,
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
        file_name: image.name,
        record_date: recordDate,
        distance_km: distanceKm,
        duration_seconds: durationSeconds,
        pace_seconds_per_km: paceSeconds,
        source_app: extracted.source_app || "러닝 앱 이미지",
        confidence_score: extracted.confidence_score ?? null,
        date_was_fallback: dateWasFallback,
      });
    }

    if (!results.length && failed.length) {
      return NextResponse.json({ error: failed[0].error, participant, results, failed }, { status: 422 });
    }

    return NextResponse.json({ success: true, participant, results, failed });
  } catch (err) {
    console.error("Personal image analysis error:", err);
    return NextResponse.json({ error: "이미지 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
