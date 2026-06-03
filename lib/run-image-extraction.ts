import { CHALLENGE_START_DATE } from "@/lib/challenge";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type UploadedImage = {
  name: string;
  dataUrl: string;
};

export type ExtractedRunBase = {
  record_date?: string | null;
  distance_km?: number | string | null;
  duration_text?: string | null;
  duration_seconds?: number | string | null;
  pace_text?: string | null;
  source_app?: string | null;
  raw_text?: string | null;
  confidence_score?: number | null;
  notes?: string | null;
};

export function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(match[1])) throw new Error("Unsupported image type");
  if (Buffer.byteLength(match[2], "base64") > MAX_IMAGE_BYTES) throw new Error("Image too large");
  return { mimeType: match[1], base64: match[2] };
}

export function validImage(input: unknown): input is UploadedImage {
  if (!input || typeof input !== "object") return false;
  const image = input as UploadedImage;
  if (typeof image.name !== "string" || typeof image.dataUrl !== "string") return false;
  try {
    parseDataUrl(image.dataUrl);
    return true;
  } catch {
    return false;
  }
}

export function resolveOcrConcurrency(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  const candidate = Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
  return Math.max(1, Math.min(Math.max(1, max), candidate));
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
) {
  if (!items.length) return [];

  const workerCount = Math.min(Math.max(1, Math.floor(limit)), items.length);
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }));

  return results;
}

export function parseJsonObject<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match?.[0] || cleaned);
}

export function parseDurationText(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string" || !value) return null;
  const compact = value.trim().replace(/：/g, ":").replace(/\s+/g, "");
  if (/^\d+\.\d{2}(\.\d{2})?$/.test(compact)) {
    const parts = compact.split(".").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      if (minutes >= 60 || seconds >= 60) return null;
      return hours * 3600 + minutes * 60 + seconds;
    }
    const [minutes, seconds] = parts;
    if (seconds >= 60) return null;
    return minutes * 60 + seconds;
  }

  const normalized = compact
    .trim()
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

export function parseDistanceKm(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const numeric = Number(value.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeRecordDate(value: unknown, fallbackYear = CHALLENGE_START_DATE.slice(0, 4)) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const korean = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (korean) return `${fallbackYear}-${korean[1].padStart(2, "0")}-${korean[2].padStart(2, "0")}`;

  const slash = text.match(/^(\d{1,2})[-./](\d{1,2})(?:\D|$)/);
  if (slash) return `${fallbackYear}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;

  return null;
}
