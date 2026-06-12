import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin-server";
import { GEMINI_OCR_CONFIG, GEMINI_OCR_MODEL, buildRunImagePrompt, getGeminiErrorDebug, getGeminiErrorMessage, isGeminiBillingError, resolveGeminiOcrModels } from "@/lib/gemini";
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
import { CHALLENGE_DATE_ERROR, CHALLENGE_START_DATE, isWithinChallengeWindow } from "@/lib/challenge";
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
import { guardMutationRequest } from "@/lib/request-security";

type ExtractedRun = ExtractedRunBase & {
  participant_name?: string | null;
};

type Participant = {
  id: string;
  name: string;
};

type ExistingRunRecord = {
  id: string;
  distance_km: number | null;
  duration_seconds: number | null;
  status: "certified" | "needs_review" | "missing" | "rejected";
};

type RecoveryUsageRecord = {
  id: string;
  source_app: string | null;
  raw_extracted_text: string | null;
  notes: string | null;
  status: string | null;
};

const MAX_IMAGES = 20;
const MAX_BODY_BYTES = MAX_IMAGES * 4 * 1024 * 1024 + 2 * 1024 * 1024;
const DEFAULT_OCR_CONCURRENCY = 4;
const DEFAULT_AUTO_FALLBACK_PARTICIPANT_NAME = "이경민";

function normalizeParticipantName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "");
}

function hasParticipantName(extractedName: string | null | undefined) {
  return typeof extractedName === "string" && normalizeParticipantName(extractedName).length > 0;
}

function matchParticipant(extractedName: string | null | undefined, participants: Participant[]) {
  if (!hasParticipantName(extractedName)) return null;
  const normalized = normalizeParticipantName(extractedName || "");

  return participants.find((participant) => {
    const name = normalizeParticipantName(participant.name);
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
  if (!input.participantId || !input.recordDate) return "needs_review";
  if (!hasMetric) return "missing";
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

      return {
        extracted: parseJsonObject<ExtractedRun>(text),
        mimeType,
        base64,
      };
    } catch (error) {
      if (isGeminiBillingError(error)) throw error;
      errors.push(`${model}: ${getGeminiErrorDebug(error)}`);
    }
  }

  throw new Error(`OCR attempts failed - ${errors.join(" | ")}`);
}

type AnalyzedAdminImage =
  | {
    ok: true;
    index: number;
    image: UploadedImage;
    analyzed: Awaited<ReturnType<typeof analyzeImage>>;
    extracted: ExtractedRun;
  }
  | {
    ok: false;
    index: number;
    image: UploadedImage;
    error: unknown;
  };

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

async function findExistingRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  participantId: string,
  recordDate: string
) {
  const { data, error } = await supabase
    .from("daily_run_records")
    .select("id, distance_km, duration_seconds, status")
    .eq("user_id", userId)
    .eq("participant_id", participantId)
    .eq("record_date", recordDate)
    .maybeSingle();

  if (error) throw error;
  return data as ExistingRunRecord | null;
}

function duplicateResult(input: {
  record: ExistingRunRecord;
  fileName: string;
  participant: Participant;
  recordDate: string;
}) {
  return {
    id: input.record.id,
    file_name: input.fileName,
    participant_id: input.participant.id,
    participant_name: input.participant.name,
    record_date: input.recordDate,
    distance_km: input.record.distance_km,
    duration_seconds: input.record.duration_seconds,
    status: "duplicate",
    duplicate: true,
    confidence_score: null,
    notes: `${input.participant.name}님은 ${input.recordDate}에 이미 인증되어 있어요. 중복 이미지는 저장하지 않았습니다.`,
  };
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
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  participantId: string;
  excludeRecordId?: string | null;
}) {
  const { data, error } = await input.supabase
    .from("daily_run_records")
    .select("id, source_app, raw_extracted_text, notes, status")
    .eq("user_id", input.userId)
    .eq("participant_id", input.participantId)
    .eq("status", "certified");

  if (error) throw error;
  return ((data || []) as RecoveryUsageRecord[])
    .filter((record) => record.id !== input.excludeRecordId)
    .filter((record) => isRecoveryCertificationRecord(record))
    .length;
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, { maxBodyBytes: MAX_BODY_BYTES });
  if (guardResponse) return guardResponse;

  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  try {
    const body = await request.json();
    const targetDate = normalizeRecordDate(body.targetDate);
    const fallbackParticipantId = typeof body.fallbackParticipantId === "string" ? body.fallbackParticipantId : null;
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
    const selectedFallbackParticipant = fallbackParticipantId
      ? participants.find((participant) => participant.id === fallbackParticipantId) || null
      : null;
    if (fallbackParticipantId && !selectedFallbackParticipant) {
      return NextResponse.json({ error: "선택한 멤버를 찾지 못했어요. 멤버 목록을 새로고침해주세요." }, { status: 400 });
    }
    const defaultAutoFallbackParticipant = participants.find(
      (participant) => normalizeParticipantName(participant.name) === normalizeParticipantName(DEFAULT_AUTO_FALLBACK_PARTICIPANT_NAME)
    ) || null;
    const fallbackParticipant = selectedFallbackParticipant || defaultAutoFallbackParticipant;

    const fallbackParticipantNote = fallbackParticipant
      ? selectedFallbackParticipant
        ? `${fallbackParticipant.name}님으로 직접 지정했어요.`
        : `이미지에서 이름이 보이지 않아 ${fallbackParticipant.name}님으로 자동 보정했어요.`
      : null;

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

    const analyzedImages = await mapWithConcurrency(
      images,
      resolveOcrConcurrency(process.env.OCR_CONCURRENCY, DEFAULT_OCR_CONCURRENCY, images.length),
      async (image, index): Promise<AnalyzedAdminImage> => {
        try {
          const analyzed = await analyzeImage(image, knownNames, targetDate);
          return { ok: true, index, image, analyzed, extracted: analyzed.extracted };
        } catch (error) {
          return { ok: false, index, image, error };
        }
      }
    );

    for (const analyzedImage of analyzedImages) {
      const { image, index } = analyzedImage;

      if (!analyzedImage.ok) {
        const { error } = analyzedImage;
        console.warn("Admin OCR image analysis failed", {
          model: GEMINI_OCR_MODEL,
          file: image.name,
          error: getGeminiErrorDebug(error),
        });
        let recordId: string | null = null;
        let filePath: string | null = null;
        const fallbackNotes = [
          getGeminiErrorMessage(error),
          `OCR 세부 오류: ${getGeminiErrorDebug(error)}`,
          fallbackParticipantNote,
          "거리와 시간은 나중에 보완해주세요.",
          !fallbackParticipant ? "멤버 매칭을 한 번 확인해주세요." : null,
        ].filter(Boolean).join(" / ");

        if (targetDate) {
          const existingRecord = fallbackParticipant?.id
            ? await findExistingRecord(supabase, user.id, fallbackParticipant.id, targetDate)
            : null;
          if (fallbackParticipant && existingRecord?.id && isCertificationCountedStatus(existingRecord.status)) {
            results.push(duplicateResult({
              record: existingRecord,
              fileName: image.name,
              participant: fallbackParticipant,
              recordDate: targetDate,
            }));
            continue;
          }

          try {
            const parsed = parseDataUrl(image.dataUrl);
            filePath = await uploadImageToStorage({
              userId: user.id,
              batchId: batch.id,
              imageIndex: index + 1,
              mimeType: parsed.mimeType,
              base64: parsed.base64,
            });
          } catch (storageError) {
            console.warn("Fallback image storage upload skipped", {
              file: image.name,
              error: storageError instanceof Error ? storageError.message : storageError,
            });
          }

          const fallbackPayload = {
            user_id: user.id,
            participant_id: fallbackParticipant?.id || null,
            upload_batch_id: batch.id,
            record_date: targetDate,
            distance_km: null,
            duration_seconds: null,
            pace_seconds_per_km: null,
            source_app: null,
            status: "missing",
            confidence_score: null,
            image_url: filePath,
            raw_extracted_text: null,
            notes: fallbackNotes,
          };

          const { data: fallbackRecord, error: fallbackRecordError } = existingRecord?.id
            ? await supabase
              .from("daily_run_records")
              .update(fallbackPayload)
              .eq("id", existingRecord.id)
              .eq("user_id", user.id)
              .select("id")
              .single()
            : await supabase
              .from("daily_run_records")
              .insert(fallbackPayload)
              .select("id")
              .single();

          if (fallbackRecordError) throw fallbackRecordError;
          recordId = fallbackRecord.id;
        }

        needsReviewCount += 1;
        results.push({
          id: recordId,
          file_name: image.name,
          participant_id: fallbackParticipant?.id || null,
          participant_name: fallbackParticipant?.name || "",
          record_date: targetDate,
          distance_km: null,
          duration_seconds: null,
          status: "missing",
          confidence_score: null,
          notes: fallbackNotes,
        });
        continue;
      }
      const analyzed = analyzedImage.analyzed;
      const extracted = analyzedImage.extracted;
      const extractedParticipantName = typeof extracted.participant_name === "string" ? extracted.participant_name : "";
      const participantNameMissing = !hasParticipantName(extractedParticipantName);
      const participant = matchParticipant(extractedParticipantName, participants) || (participantNameMissing ? fallbackParticipant : null);
      const usedFallbackParticipant = participantNameMissing && Boolean(fallbackParticipant);
      const extractedDate = normalizeRecordDate(extracted.record_date);
      const recordDate = extractedDate || targetDate;
      const dateWasFallback = !extractedDate && Boolean(targetDate);
      const extractedDurationSeconds = parseDurationText(extracted.duration_seconds ?? extracted.duration_text);
      const extractedDistanceKm = parseDistanceKm(extracted.distance_km);
      const isRecoveryCertification = isRecoveryExtraction(extracted, extractedDistanceKm, extractedDurationSeconds);
      const durationSeconds = isRecoveryCertification ? RECOVERY_CERTIFICATION_DURATION_SECONDS : extractedDurationSeconds;
      const distanceKm = isRecoveryCertification ? RECOVERY_CERTIFICATION_DISTANCE_KM : extractedDistanceKm;

      if (recordDate && !isWithinChallengeWindow(recordDate)) {
        return NextResponse.json({ error: CHALLENGE_DATE_ERROR }, { status: 400 });
      }

      let existingRecord: ExistingRunRecord | null = null;
      if (participant?.id && recordDate) {
        existingRecord = await findExistingRecord(supabase, user.id, participant.id, recordDate);
        if (existingRecord?.id && isCertificationCountedStatus(existingRecord.status)) {
          results.push(duplicateResult({
            record: existingRecord,
            fileName: image.name,
            participant,
            recordDate,
          }));
          continue;
        }
      }

      const paceSeconds = calculatePaceSeconds(distanceKm, durationSeconds);
      let status = decideStatus({
        participantId: participant?.id,
        recordDate,
        distanceKm,
        durationSeconds,
        dateWasFallback,
        allowFallbackDate: Boolean(targetDate),
      });
      let recoveryLimitNote: string | null = null;
      if (isRecoveryCertification && participant?.id) {
        const recoveryUsageCount = await countCertifiedRecoveryUsage({
          supabase,
          userId: user.id,
          participantId: participant.id,
          excludeRecordId: existingRecord?.id || null,
        });
        if (recoveryUsageCount >= RECOVERY_CERTIFICATION_LIMIT) {
          status = "needs_review";
          recoveryLimitNote = `리커버리 인증 ${RECOVERY_CERTIFICATION_LIMIT}회를 이미 사용했어요.`;
        }
      }

      if (status !== "certified") needsReviewCount += 1;

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
        source_app: isRecoveryCertification ? RECOVERY_CERTIFICATION_SOURCE : extracted.source_app || null,
        status,
        confidence_score: extracted.confidence_score ?? null,
        image_url: filePath,
        raw_extracted_text: extracted.raw_text || null,
        notes: [
          isRecoveryCertification ? RECOVERY_CERTIFICATION_NOTE : null,
          recoveryLimitNote,
          extracted.notes,
          usedFallbackParticipant ? fallbackParticipantNote : null,
          dateWasFallback ? "이미지에서 날짜가 보이지 않아 선택한 날짜를 임시 적용했어요." : null,
          !distanceKm ? "거리는 나중에 보완할 수 있어요." : null,
          !durationSeconds ? "시간은 나중에 보완할 수 있어요." : null,
          !participant ? "멤버 매칭을 한 번 확인해주세요." : null,
          !filePath ? "이미지 파일 저장은 건너뛰고 추출 기록만 저장했어요." : null,
        ].filter(Boolean).join(" / ") || null,
      };

      const { data: record, error: recordError } = existingRecord?.id
        ? await supabase
          .from("daily_run_records")
          .update(recordPayload)
          .eq("id", existingRecord.id)
          .eq("user_id", user.id)
          .select("id")
          .single()
        : await supabase
          .from("daily_run_records")
          .insert(recordPayload)
          .select("id")
          .single();

      if (recordError) throw recordError;

      results.push({
        id: record.id,
        file_name: image.name,
        participant_id: participant?.id || null,
        participant_name: participant?.name || extractedParticipantName,
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
