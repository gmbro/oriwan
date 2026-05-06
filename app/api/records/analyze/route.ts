import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/admin-server";
import { calculatePaceSeconds } from "@/lib/run-records";
import { CHALLENGE_DATE_ERROR, isWithinChallengeWindow } from "@/lib/challenge";

type UploadedImage = {
  name: string;
  dataUrl: string;
};

type ExtractedRun = {
  participant_name?: string | null;
  record_date?: string | null;
  distance_km?: number | null;
  duration_text?: string | null;
  duration_seconds?: number | null;
  pace_text?: string | null;
  source_app?: string | null;
  raw_text?: string | null;
  confidence_score?: number | null;
  notes?: string | null;
};

type Participant = {
  id: string;
  name: string;
  nickname: string | null;
};

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  return { mimeType: match[1], base64: match[2] };
}

function parseJson(text: string): ExtractedRun {
  const cleaned = text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

function parseDurationText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value
    .replace(/[^\d:시간분초hms]/g, " ")
    .replace(/시간|h/gi, ":")
    .replace(/분|m/gi, ":")
    .replace(/초|s/gi, "")
    .replace(/\s+/g, "")
    .replace(/:+$/g, "");

  const parts = normalized.split(":").filter(Boolean).map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60;
  return null;
}

function matchParticipant(extractedName: string | null | undefined, participants: Participant[]) {
  if (!extractedName) return null;
  const normalized = extractedName.toLowerCase().replace(/\s+/g, "");

  return participants.find((participant) => {
    const name = participant.name.toLowerCase().replace(/\s+/g, "");
    const nickname = participant.nickname?.toLowerCase().replace(/\s+/g, "");
    return normalized.includes(name) || name.includes(normalized) || Boolean(nickname && (normalized.includes(nickname) || nickname.includes(normalized)));
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
  const { mimeType, base64 } = parseDataUrl(image.dataUrl);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const prompt = `러닝 인증 이미지에서 배경/사진/앱 장식은 무시하고 텍스트와 숫자만 읽어 JSON으로 추출하세요.

이미지에 보이는 텍스트만 근거로 판단하세요. 날짜가 보이지 않으면 record_date는 null, 시간이 보이지 않으면 duration_seconds는 null로 두세요.
참가자 이름은 아래 등록된 이름/닉네임 중 이미지에서 보이는 값과 가장 가까운 것을 넣고, 확실하지 않으면 null로 두세요.

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

  return {
    extracted: parseJson(response.text || "{}"),
    mimeType,
    base64,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, response } = await requireAdminUser(supabase);
  if (response) return response;

  try {
    const body = await request.json();
    const targetDate = typeof body.targetDate === "string" ? body.targetDate : null;
    const images = Array.isArray(body.images) ? body.images as UploadedImage[] : [];

    if (!images.length) {
      return NextResponse.json({ error: "이미지가 필요합니다." }, { status: 400 });
    }
    if (targetDate && !isWithinChallengeWindow(targetDate)) {
      return NextResponse.json({ error: CHALLENGE_DATE_ERROR }, { status: 400 });
    }

    const { data: participantsData, error: participantError } = await supabase
      .from("participants")
      .select("id, name, nickname")
      .eq("user_id", user.id)
      .eq("active", true);

    if (participantError) throw participantError;

    const participants = (participantsData || []) as Participant[];
    const knownNames = participants.flatMap((participant) => [participant.name, participant.nickname].filter(Boolean) as string[]);

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

    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const results = [];
    let needsReviewCount = 0;

    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const analyzed = await analyzeImage(image, knownNames);
      const extracted = analyzed.extracted;
      const participant = matchParticipant(extracted.participant_name, participants);
      const recordDate = extracted.record_date || targetDate;
      const dateWasFallback = !extracted.record_date && Boolean(targetDate);
      const durationSeconds = extracted.duration_seconds ?? parseDurationText(extracted.duration_text);
      const distanceKm = typeof extracted.distance_km === "number" ? extracted.distance_km : null;

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

      const extension = analyzed.mimeType.split("/")[1] || "jpg";
      const filePath = `run-records/${user.id}/${batch.id}/${index + 1}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("photos")
        .upload(filePath, Buffer.from(analyzed.base64, "base64"), {
          contentType: analyzed.mimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

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
        ].filter(Boolean).join(" / ") || null,
      };

      const { data: record, error: recordError } = await supabase
        .from("daily_run_records")
        .insert(recordPayload)
        .select("id")
        .single();

      if (recordError) throw recordError;

      results.push({
        id: record.id,
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
