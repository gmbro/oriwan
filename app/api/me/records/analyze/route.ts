import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { buildMemberRunImagePrompt, GEMINI_OCR_MODEL, getMemberGeminiOcrConfig, logGeminiOcrUsage } from "@/lib/gemini";
import { MEMBER_UPLOAD_MAX_BYTES, type MemberUploadDraft } from "@/lib/member-upload-contract";
import { memberJson, ownedMember, privateUploadStore, readUploadDraft, reserveOcrQuota, uploadPrefix } from "@/lib/member-upload-server";
import { parseDistanceKm, parseDurationText, parseJsonObject, type ExtractedRunBase } from "@/lib/run-image-extraction";
import { toKstIsoDate } from "@/lib/run-records";
import { guardMutationRequest, readLimitedFormData } from "@/lib/request-security";
import { isSupportedRasterSignature } from "@/lib/image-signature";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const maximum = MEMBER_UPLOAD_MAX_BYTES + 128 * 1024;
  const guard = guardMutationRequest(request, { maxBodyBytes: maximum, rateLimit: { key: "own-run-ocr", limit: 12, windowMs: 60_000 } });
  if (guard) return guard;
  const owned = await ownedMember();
  if ("response" in owned) return owned.response;
  const form = await readLimitedFormData(request, maximum);
  if (!form.ok) return form.response;
  const uploadedAt = new Date().toISOString();
  const file = form.formData.get("file");
  if (!file || typeof file === "string" || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return memberJson({ error: "JPG, PNG, WebP 인증샷을 선택해주세요." }, 415);
  if (!file.size || file.size > MEMBER_UPLOAD_MAX_BYTES) return memberJson({ error: "3MB 이하의 사진을 선택해주세요." }, 413);
  let bytes: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    // MIME headers are user-controlled. Reject AVIF/HEIF, SVG and mislabeled
    // files before sharp.metadata() can invoke a native decoder.
    if (!isSupportedRasterSignature(input, file.type)) {
      return memberJson({ error: "실제 JPG, PNG, WebP 이미지인지 확인해주세요." }, 415);
    }
    const image = sharp(input, { limitInputPixels: 24_000_000, animated: false });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || "") || (metadata.pages ?? 1) > 1) throw new Error("format");
    bytes = await image.rotate().resize({ width: 1800, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
  } catch { return memberJson({ error: "사진을 읽을 수 없어요. 다른 캡처본을 선택해주세요." }, 400); }
  try {
    const { service, authUserId } = owned.context;
    const store = await privateUploadStore(service);
    const today = toKstIsoDate();
    const id = `${today}/${createHash("sha256").update(bytes).digest("hex")}`;
    const prefix = uploadPrefix(authUserId, id);
    const cached = await readUploadDraft(store, prefix);
    if (cached && cached.participantId === owned.participantId && !cached.analysisError) return memberJson({ draft: cached });
    if (!await reserveOcrQuota(store, authUserId, today)) return memberJson({ error: "하루 최대 8장의 인증샷을 인식할 수 있어요. 이미 인식한 사진은 다시 선택할 수 있어요." }, 429);
    const imageResult = await store.upload(`${prefix}/image.webp`, bytes, { contentType: "image/webp", upsert: false });
    if (imageResult.error) {
      if (/duplicate|already exists/i.test(imageResult.error.message) && !cached?.analysisError) return memberJson({ error: "같은 사진을 처리 중이에요. 잠시 후 다시 선택해주세요." }, 409);
      if (!cached?.analysisError || !/duplicate|already exists/i.test(imageResult.error.message)) throw imageResult.error;
    }
    const draft: MemberUploadDraft = { id, participantId: owned.participantId, createdAt: uploadedAt, date: null, distanceKm: null, durationSeconds: null, confidence: null, rawText: "", model: GEMINI_OCR_MODEL, warning: null };
    let analysisPhase: "configuration" | "service" | "response" = "configuration";
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error("configuration");
      analysisPhase = "service";
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 20_000, retryOptions: { attempts: 1 } } });
      const response = await ai.models.generateContent({
        model: GEMINI_OCR_MODEL,
        contents: [{ role: "user", parts: [{ text: buildMemberRunImagePrompt() }, { inlineData: { mimeType: "image/webp", data: bytes.toString("base64") } }] }],
        config: getMemberGeminiOcrConfig(),
      });
      logGeminiOcrUsage(GEMINI_OCR_MODEL, response);
      analysisPhase = "response";
      const extracted = parseJsonObject<ExtractedRunBase>(response.text || "");
      draft.date = /^\d{4}-\d{2}-\d{2}$/.test(extracted.record_date || "") ? extracted.record_date! : null;
      draft.activityDate = /^\d{4}-\d{2}-\d{2}$/.test(extracted.activity_date || "") ? extracted.activity_date! : null;
      draft.activityTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(extracted.activity_time || "") ? extracted.activity_time! : null;
      draft.distanceKm = parseDistanceKm(extracted.distance_km);
      draft.durationSeconds = parseDurationText(extracted.duration_seconds ?? extracted.duration_text);
      draft.confidence = typeof extracted.confidence_score === "number" ? extracted.confidence_score : null;
      draft.rawText = String(extracted.raw_text || "").slice(0, 4000);
      if (!draft.activityDate || !draft.activityTime || !draft.date || !draft.distanceKm || !draft.durationSeconds || (draft.confidence ?? 0) < 0.8) draft.warning = "일부 값은 확인이 필요해요. 캡처본과 비교해 입력해주세요.";
    } catch (error) {
      const timedOut = error instanceof Error && /timeout|timed out|abort/i.test(error.message);
      draft.analysisError = timedOut ? "timeout" : analysisPhase;
      draft.warning = draft.analysisError === "configuration"
        ? "사진은 저장됐지만 인식 서비스 설정이 준비되지 않았어요. 운영자에게 문의해주세요."
        : draft.analysisError === "timeout"
          ? "사진은 저장됐지만 인식 서버의 응답 시간이 초과됐어요. 잠시 후 다시 시도해주세요."
          : draft.analysisError === "response"
            ? "사진은 저장됐지만 인식 결과를 해석하지 못했어요. 다른 캡처를 선택하거나 운영자에게 문의해주세요."
            : "사진은 저장됐지만 인식 서비스에서 정상 응답을 받지 못했어요. 운영자에게 문의해주세요.";
    }
    const saved = await store.upload(`${prefix}/draft.json`, JSON.stringify(draft), { contentType: "application/json", upsert: Boolean(cached?.analysisError) });
    if (saved.error) throw saved.error;
    return memberJson({ draft }, 201);
  } catch {
    return memberJson({ error: "인증샷을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, 503);
  }
}
