import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin-server";
import { GEMINI_OCR_MODEL, getGeminiErrorMessage } from "@/lib/gemini";
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
}) {
  if (!input.participantId || !input.recordDate || !input.distanceKm || !input.durationSeconds) return "needs_review";
  if (input.dateWasFallback) return "needs_review";
  return "certified";
}

async function analyzeImage(image: UploadedImage, knownNames: string[]) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  const { mimeType, base64 } = parseDataUrl(image.dataUrl);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `러닝 인증 이미지에서 배경/사진/앱 장식은 무시하고 텍스트와 숫자만 읽어 JSON으로 추출하세요.

이미지에 보이는 텍스트만 근거로 판단하세요. 날짜가 "5월 5일"처럼 연도 없이 보이면 ${CHALLENGE_START_DATE.slice(0, 4)}년으로 보정해 record_date를 YYYY-MM-DD로 넣으세요.
날짜가 전혀 보이지 않으면 record_date는 null, 시간이 보이지 않으면 duration_seconds는 null로 두세요.
거리 단위가 km가 아니면 km로 환산하세요. 시간은 전체 러닝 시간을 의미하며 페이스가 아닙니다.
참가자 이름은 아래 등록된 이름 중 이미지에서 보이는 값과 가장 가까운 것을 넣고, 확실하지 않으면 null로 두세요.
파일명은 근거로 사용하지 말고 이미지 안의 텍스트만 사용하세요.

등록된 참가자:
${knownNames.length ? knownNames.join(", ") : "없음"}

반드시 아래 JSON 형식만 반환하세요.
{
  "participant_name": string | null,
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
    const requestedParticipantId =
      typeof body.participantId === "string"
        ? body.participantId
        : typeof body.participant_id === "string"
          ? body.participant_id
          : "";
    const rawImages = Array.isArray(body.images) ? body.images : [];
    const images = rawImages.filter(validImage).slice(0, MAX_IMAGES);

    if (!images.length) {
      return NextResponse.json({ error: "이미지가 필요합니다." }, { status: 400 });
    }
    if (rawImages.length > MAX_IMAGES) {
      return NextResponse.json({ error: `이미지는 한 번에 ${MAX_IMAGES}장까지 업로드할 수 있습니다.` }, { status: 400 });
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
    const targetParticipant = requestedParticipantId
      ? participants.find((participant) => participant.id === requestedParticipantId) || null
      : null;

    if (requestedParticipantId && !targetParticipant) {
      return NextResponse.json({ error: "선택한 참가자를 찾을 수 없습니다." }, { status: 400 });
    }

    const knownNames = targetParticipant ? [targetParticipant.name] : participants.map((participant) => participant.name);

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
        analyzed = await analyzeImage(image, knownNames);
        extracted = analyzed.extracted;
      } catch (error) {
        needsReviewCount += 1;
        results.push({
          id: null,
          file_name: image.name,
          participant_id: targetParticipant?.id || null,
          participant_name: targetParticipant?.name || "",
          record_date: targetDate,
          distance_km: null,
          duration_seconds: null,
          status: "needs_review",
          confidence_score: null,
          notes: getGeminiErrorMessage(error),
        });
        continue;
      }
      const participant = targetParticipant || matchParticipant(extracted.participant_name, participants);
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
          dateWasFallback ? "이미지에서 날짜가 보이지 않아 선택한 날짜를 임시 적용했습니다." : null,
          !durationSeconds ? "시간이 없어 수동 입력이 필요합니다." : null,
          !participant ? "참가자 매칭 확인이 필요합니다." : null,
          !filePath ? "이미지 파일 저장은 건너뛰고 추출 기록만 저장했습니다." : null,
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
    return NextResponse.json({ error: "이미지 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
