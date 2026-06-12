import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { findAdminUserId, findParticipantByRunnerName, getServiceClient } from "@/lib/admin-data";
import { CHALLENGE_DATE_ERROR, CHALLENGE_START_DATE, isWithinChallengeWindow } from "@/lib/challenge";
import { GEMINI_OCR_CONFIG, GEMINI_OCR_MODEL, buildRunImagePrompt, getGeminiErrorDebug, getGeminiErrorMessage, isGeminiBillingError, resolveGeminiOcrModels } from "@/lib/gemini";
import {
  ExtractedRunBase,
  UploadedImage,
  mapWithConcurrency,
  normalizeRecordDate,
  parseDataUrl,
  parseDistanceKm,
  parseDurationText,
  parseJsonObject,
  resolveOcrConcurrency,
  validImage,
} from "@/lib/run-image-extraction";
import {
  RECOVERY_CERTIFICATION_DISTANCE_KM,
  RECOVERY_CERTIFICATION_DURATION_SECONDS,
  RECOVERY_CERTIFICATION_LIMIT,
  RECOVERY_CERTIFICATION_NOTE,
  RECOVERY_CERTIFICATION_SOURCE,
  calculatePaceSeconds,
  hasRecoveryCertificationText,
  isCertificationCountedStatus,
  isRecoveryCertificationFlag,
  isRecoveryCertificationRecord,
} from "@/lib/run-records";
import { createClient } from "@/lib/supabase/server";
import { guardMutationRequest } from "@/lib/request-security";

type ExtractedRun = ExtractedRunBase;

const MAX_IMAGES = 20;
const MAX_BODY_BYTES = MAX_IMAGES * 4 * 1024 * 1024 + 512 * 1024;
const DEFAULT_OCR_CONCURRENCY = 3;

type AnalyzeFailure = {
  file_name: string;
  error: string;
  extracted?: ExtractedRun;
};

type ExistingRunRecord = {
  id: string;
  record_date: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  pace_seconds_per_km: number | null;
  source_app: string | null;
  confidence_score: number | null;
  status: string | null;
};

type RecoveryUsageRecord = {
  id: string;
  source_app: string | null;
  raw_extracted_text: string | null;
  notes: string | null;
  status: string | null;
};

async function analyzeImage(image: UploadedImage, targetDate?: string | null) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

  const { mimeType, base64 } = parseDataUrl(image.dataUrl);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = buildRunImagePrompt({
    challengeYear: CHALLENGE_START_DATE.slice(0, 4),
    targetDate,
  });

  const errors: string[] = [];
  for (const model of resolveGeminiOcrModels()) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64 } },
            ],
          },
        ],
        config: GEMINI_OCR_CONFIG,
      });

      const text = response.text || "";
      if (!text.trim()) throw new Error("empty response");
      return parseJsonObject<ExtractedRun>(text);
    } catch (error) {
      if (isGeminiBillingError(error)) throw error;
      errors.push(`${model}: ${getGeminiErrorDebug(error)}`);
    }
  }

  throw new Error(`OCR attempts failed - ${errors.join(" | ")}`);
}

type AnalyzedPersonalImage =
  | {
    ok: true;
    image: UploadedImage;
    extracted: ExtractedRun;
  }
  | {
    ok: false;
    image: UploadedImage;
    error: unknown;
  };

async function findExistingRecord(
  service: NonNullable<ReturnType<typeof getServiceClient>>,
  adminUserId: string,
  participantId: string,
  recordDate: string
) {
  const { data, error } = await service
    .from("daily_run_records")
    .select("id, record_date, distance_km, duration_seconds, pace_seconds_per_km, source_app, confidence_score, status")
    .eq("user_id", adminUserId)
    .eq("participant_id", participantId)
    .eq("record_date", recordDate)
    .maybeSingle();

  if (error) throw error;
  return data as ExistingRunRecord | null;
}

function isRecoveryExtraction(extracted: ExtractedRun, distanceKm: number | null, durationSeconds: number | null) {
  const hasVisibleMetric = Boolean((distanceKm && distanceKm > 0) || (durationSeconds && durationSeconds > 0));
  return (
    isRecoveryCertificationFlag(extracted.is_recovery_certification) ||
    (
      hasVisibleMetric &&
      (
        hasRecoveryCertificationText(extracted.raw_text) ||
        hasRecoveryCertificationText(extracted.notes) ||
        hasRecoveryCertificationText(extracted.source_app)
      )
    )
  );
}

async function countCertifiedRecoveryUsage(input: {
  service: NonNullable<ReturnType<typeof getServiceClient>>;
  adminUserId: string;
  participantId: string;
  excludeRecordId?: string | null;
}) {
  const { data, error } = await input.service
    .from("daily_run_records")
    .select("id, source_app, raw_extracted_text, notes, status")
    .eq("user_id", input.adminUserId)
    .eq("participant_id", input.participantId)
    .eq("status", "certified");

  if (error) throw error;
  return ((data || []) as RecoveryUsageRecord[])
    .filter((record) => record.id !== input.excludeRecordId)
    .filter((record) => isRecoveryCertificationRecord(record))
    .length;
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
    const images = rawImages.filter(validImage).slice(0, MAX_IMAGES) as UploadedImage[];

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

    const analyzedImages = await mapWithConcurrency(
      images,
      resolveOcrConcurrency(process.env.OCR_CONCURRENCY, DEFAULT_OCR_CONCURRENCY, images.length),
      async (image): Promise<AnalyzedPersonalImage> => {
        try {
          return { ok: true, image, extracted: await analyzeImage(image, targetDate) };
        } catch (error) {
          if (isGeminiBillingError(error)) throw error;
          return { ok: false, image, error };
        }
      }
    );

    for (const analyzedImage of analyzedImages) {
      const { image } = analyzedImage;
      if (!analyzedImage.ok) {
        const { error } = analyzedImage;
        console.warn("Personal OCR image analysis failed", {
          model: GEMINI_OCR_MODEL,
          file: image.name,
          error: getGeminiErrorDebug(error),
        });
        failed.push({ file_name: image.name, error: getGeminiErrorMessage(error) });
        continue;
      }
      const extracted = analyzedImage.extracted;

      const extractedDate = normalizeRecordDate(extracted.record_date);
      const recordDate = targetDate || extractedDate;
      const dateWasFallback = Boolean(targetDate && !extractedDate);
      const dateWasSelectedOverride = Boolean(targetDate && extractedDate && extractedDate !== targetDate);
      const extractedDistanceKm = parseDistanceKm(extracted.distance_km);
      const extractedDurationSeconds = parseDurationText(extracted.duration_seconds ?? extracted.duration_text);
      const isRecoveryCertification = isRecoveryExtraction(extracted, extractedDistanceKm, extractedDurationSeconds);
      const distanceKm = isRecoveryCertification ? RECOVERY_CERTIFICATION_DISTANCE_KM : extractedDistanceKm;
      const durationSeconds = isRecoveryCertification ? RECOVERY_CERTIFICATION_DURATION_SECONDS : extractedDurationSeconds;

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

      const existingRecord = await findExistingRecord(service, adminUserId, participant.id, recordDate);
      if (existingRecord?.id && isCertificationCountedStatus(existingRecord.status)) {
        results.push({
          id: existingRecord.id,
          file_name: image.name,
          record_date: existingRecord.record_date,
          distance_km: existingRecord.distance_km,
          duration_seconds: existingRecord.duration_seconds,
          pace_seconds_per_km: existingRecord.pace_seconds_per_km,
          source_app: existingRecord.source_app || "기존 인증",
          confidence_score: existingRecord.confidence_score,
          date_was_fallback: dateWasFallback,
          duplicate: true,
        });
        continue;
      }
      if (isRecoveryCertification) {
        const recoveryUsageCount = await countCertifiedRecoveryUsage({
          service,
          adminUserId,
          participantId: participant.id,
          excludeRecordId: existingRecord?.id || null,
        });
        if (recoveryUsageCount >= RECOVERY_CERTIFICATION_LIMIT) {
          failed.push({ file_name: image.name, error: `${RECOVERY_CERTIFICATION_NOTE} ${RECOVERY_CERTIFICATION_LIMIT}회를 이미 사용했어요.`, extracted });
          continue;
        }
      }

      const paceSeconds = calculatePaceSeconds(distanceKm, durationSeconds);
      const notes = [
        isRecoveryCertification ? RECOVERY_CERTIFICATION_NOTE : null,
        `${image.name} 이미지에서 자동 추출`,
        extracted.source_app ? `앱: ${extracted.source_app}` : null,
        dateWasFallback ? "이미지에 날짜가 없어 선택한 날짜를 적용" : null,
        dateWasSelectedOverride ? `이미지 날짜(${extractedDate}) 대신 선택한 날짜(${targetDate})를 적용` : null,
        !distanceKm ? "거리는 나중에 보완 가능" : null,
        !durationSeconds ? "시간은 나중에 보완 가능" : null,
        extracted.notes,
      ].filter(Boolean).join(" / ");

      const recordPayload = {
        user_id: adminUserId,
        participant_id: participant.id,
        record_date: recordDate,
        distance_km: distanceKm,
        duration_seconds: durationSeconds,
        pace_seconds_per_km: paceSeconds,
        source_app: isRecoveryCertification ? RECOVERY_CERTIFICATION_SOURCE : extracted.source_app || "participant_image",
        status: "certified",
        confidence_score: extracted.confidence_score ?? null,
        raw_extracted_text: extracted.raw_text || null,
        notes,
      };

      const { data, error: saveError } = existingRecord?.id
        ? await service
          .from("daily_run_records")
          .update(recordPayload)
          .eq("id", existingRecord.id)
          .eq("user_id", adminUserId)
          .select("id")
          .single()
        : await service
          .from("daily_run_records")
          .insert(recordPayload)
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
        source_app: isRecoveryCertification ? RECOVERY_CERTIFICATION_NOTE : extracted.source_app || "러닝 앱 이미지",
        confidence_score: extracted.confidence_score ?? null,
        date_was_fallback: dateWasFallback || dateWasSelectedOverride,
      });
    }

    if (!results.length && failed.length) {
      return NextResponse.json({ error: failed[0].error, participant, results, failed }, { status: 422 });
    }

    return NextResponse.json({ success: true, participant, results, failed });
  } catch (err) {
    console.error("Personal image analysis error:", err);
    if (isGeminiBillingError(err)) {
      return NextResponse.json({ error: getGeminiErrorMessage(err) }, { status: 429 });
    }
    return NextResponse.json({ error: "이미지 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
