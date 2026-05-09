import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin-server";
import { GEMINI_OCR_MODEL, RUN_IMAGE_RESPONSE_SCHEMA, buildRunImagePrompt, getGeminiErrorDebug, getGeminiErrorMessage } from "@/lib/gemini";
import { calculatePaceSeconds } from "@/lib/run-records";
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

type ExtractedRun = ExtractedRunBase & {
  participant_name?: string | null;
};

type Participant = {
  id: string;
  name: string;
};

const MAX_IMAGES = 40;

function matchParticipant(extractedName: string | null | undefined, participants: Participant[]) {
  if (!extractedName) return null;
  const normalized = extractedName.toLowerCase().replace(/\s+/g, "");

  return participants.find((participant) => {
    const name = participant.name.toLowerCase().replace(/\s+/g, "");
    return normalized.includes(name) || name.includes(normalized);
  }) || null;
}

function decideStatus(input: {
  participantId?: string | null;
  recordDate?: string | null;
  distanceKm?: number | null;
  durationSeconds?: number | null;
  dateWasFallback: boolean;
  allowFallbackDate: boolean;
}) {
  const hasMetric = Boolean((input.distanceKm && input.distanceKm > 0) || (input.durationSeconds && input.durationSeconds > 0));
  if (!input.participantId || !input.recordDate || !hasMetric) return "needs_review";
  if (input.dateWasFallback && !input.allowFallbackDate) return "needs_review";
  return "certified";
}

async function analyzeImage(image: UploadedImage, knownNames: string[], targetDate?: string | null) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  const { mimeType, base64 } = parseDataUrl(image.dataUrl);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = buildRunImagePrompt({
    challengeYear: CHALLENGE_START_DATE.slice(0, 4),
    targetDate,
    knownNames,
    includeParticipantName: true,
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

  return {
    extracted: parseJsonObject<ExtractedRun>(response.text || "{}"),
    mimeType,
    base64,
  };
}

async function uploadImageToStorage(input: {
  userId: string;
  batchId: string;
  imageIndex: number;
  mimeType: string;
  base64: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabaseAdmin = createSupabaseAdmin(url, key);
  const extension = input.mimeType.split("/")[1] || "jpg";
  const filePath = `run-records/${input.userId}/${input.batchId}/${input.imageIndex}-${Date.now()}.${extension}`;
  const { error } = await supabaseAdmin.storage
    .from("photos")
    .upload(filePath, Buffer.from(input.base64, "base64"), {
      contentType: input.mimeType,
      upsert: true,
    });

  if (error) {
    console.warn("Image storage upload skipped:", error.message);
    return null;
  }

  return filePath;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  try {
    const body = await request.json();
    const targetDate = normalizeRecordDate(body.targetDate);
    const rawImages = Array.isArray(body.images) ? body.images : [];
    const images = rawImages.filter(validImage).slice(0, MAX_IMAGES) as UploadedImage[];

    if (!images.length) {
      return NextResponse.json({ error: "러닝 이미지를 먼저 올려주세요." }, { status: 400 });
    }
    if (rawImages.length > MAX_IMAGES) {
      return NextResponse.json({ error: `이미지는 한 번에 ${MAX_IMAGES}장까지 올릴 수 있어요.` }, { status: 400 });
    }
    if (images.length !== rawImages.length) {
      return NextResponse.json({ error: "지원하지 않는 이미지 형식이거나 파일 용량이 너무 큽니다." }, { status: 400 });
    }
    if (targetDate && !isWithinChallengeWindow(targetDate)) {
      return NextResponse.json({ error: CHALLENGE_DATE_ERROR }, { status: 400 });
    }

    const { data: participantsData, error: participantError } = await supabase
      .from("participants")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("active", true);

    if (participantError) throw participantError;

    const participants = (participantsData || []) as Participant[];
    const knownNames = participants.map((participant) => participant.name);

    const { data: batch, error: batchError } = await supabase
      .from("upload_batches")
      .insert({
        user_id: user.id,
        record_date: targetDate,
        total_images: images.length,
        processed_count: 0,
        needs_review_count: 0,
      })
      .select("id")
      .single();

    if (batchError) throw batchError;

    const results = [];
    let needsReviewCount = 0;

    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];

      let analyzed: Awaited<ReturnType<typeof analyzeImage>>;
      let extracted: ExtractedRun;
      try {
        analyzed = await analyzeImage(image, knownNames, targetDate);
        extracted = analyzed.extracted;
      } catch (error) {
        console.warn("Admin OCR image analysis failed", {
          model: GEMINI_OCR_MODEL,
          file: image.name,
          error: getGeminiErrorDebug(error),
        });
        needsReviewCount += 1;
        results.push({
          id: null,
          file_name: image.name,
          participant_id: null,
          participant_name: "",
          record_date: targetDate,
          distance_km: null,
          duration_seconds: null,
          status: "needs_review",
          confidence_score: null,
          notes: getGeminiErrorMessage(error),
        });
        continue;
      }
      const participant = matchParticipant(extracted.participant_name, participants);
      const extractedDate = normalizeRecordDate(extracted.record_date);
      const recordDate = extractedDate || targetDate;
      const dateWasFallback = !extractedDate && Boolean(targetDate);
      const durationSeconds = parseDurationText(extracted.duration_seconds ?? extracted.duration_text);
      const distanceKm = parseDistanceKm(extracted.distance_km);

      if (recordDate && !isWithinChallengeWindow(recordDate)) {
        return NextResponse.json({ error: CHALLENGE_DATE_ERROR }, { status: 400 });
      }

      const paceSeconds = calculatePaceSeconds(distanceKm, durationSeconds);
      const status = decideStatus({
        participantId: participant?.id,
        recordDate,
        distanceKm,
        durationSeconds,
        dateWasFallback,
        allowFallbackDate: Boolean(targetDate),
      });

      if (status === "needs_review") needsReviewCount += 1;

      const filePath = await uploadImageToStorage({
        userId: user.id,
        batchId: batch.id,
        imageIndex: index + 1,
        mimeType: analyzed.mimeType,
        base64: analyzed.base64,
      });

      const recordPayload = {
        user_id: user.id,
        participant_id: participant?.id || null,
        upload_batch_id: batch.id,
        record_date: recordDate,
        distance_km: distanceKm,
        duration_seconds: durationSeconds,
        pace_seconds_per_km: paceSeconds,
        source_app: extracted.source_app || null,
        status,
        confidence_score: extracted.confidence_score ?? null,
        image_url: filePath,
        raw_extracted_text: extracted.raw_text || null,
        notes: [
          extracted.notes,
          dateWasFallback ? "이미지에서 날짜가 보이지 않아 선택한 날짜를 임시 적용했어요." : null,
          !distanceKm ? "거리는 나중에 보완할 수 있어요." : null,
          !durationSeconds ? "시간은 나중에 보완할 수 있어요." : null,
          !participant ? "멤버 매칭을 한 번 확인해주세요." : null,
          !filePath ? "이미지 파일 저장은 건너뛰고 추출 기록만 저장했어요." : null,
        ].filter(Boolean).join(" / ") || null,
      };

      const recordQuery = participant?.id && recordDate
        ? supabase
            .from("daily_run_records")
            .upsert(recordPayload, { onConflict: "user_id,participant_id,record_date" })
        : supabase
            .from("daily_run_records")
            .insert(recordPayload);

      const { data: record, error: recordError } = await recordQuery
        .select("id")
        .single();

      if (recordError) throw recordError;

      results.push({
        id: record.id,
        file_name: image.name,
        participant_id: participant?.id || null,
        participant_name: participant?.name || extracted.participant_name || "",
        record_date: recordDate,
        distance_km: distanceKm,
        duration_seconds: durationSeconds,
        status,
        confidence_score: extracted.confidence_score ?? null,
        notes: recordPayload.notes,
      });
    }

    await supabase
      .from("upload_batches")
      .update({
        processed_count: images.length,
        needs_review_count: needsReviewCount,
      })
      .eq("id", batch.id)
      .eq("user_id", user.id);

    return NextResponse.json({ batch_id: batch.id, results });
  } catch (err) {
    console.error("Image analysis error:", err);
    return NextResponse.json({ error: "이미지를 읽는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
