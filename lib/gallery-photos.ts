import { CHALLENGE_START_DATE } from "@/lib/challenge";

export const GALLERY_BUCKET = process.env.SUPABASE_GALLERY_BUCKET || "snasa-gallery";
export const GALLERY_SIGNED_URL_SECONDS = 60 * 60 * 12;

const GALLERY_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]);

function validIsoDate(year: string, month: string, day: string) {
  const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== Number(year)) return null;
  if (date.getMonth() + 1 !== Number(month)) return null;
  if (date.getDate() !== Number(day)) return null;

  return normalized;
}

export function isGalleryImageFile(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  return Boolean(extension && GALLERY_IMAGE_EXTENSIONS.has(extension));
}

export function parseGalleryDate(value: string, fallbackYear = CHALLENGE_START_DATE.slice(0, 4)) {
  const text = value.trim();
  if (!text) return null;

  const iso = text.match(/(20\d{2})[-_.\s년]+(\d{1,2})[-_.\s월]+(\d{1,2})/);
  if (iso) return validIsoDate(iso[1], iso[2], iso[3]);

  const compactIso = text.match(/(20\d{2})(\d{2})(\d{2})/);
  if (compactIso) return validIsoDate(compactIso[1], compactIso[2], compactIso[3]);

  const korean = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (korean) return validIsoDate(fallbackYear, korean[1], korean[2]);

  const monthDay = text.match(/(?:^|[^\d])(\d{1,2})[-_.\s]+(\d{1,2})(?:[^\d]|$)/);
  if (monthDay) return validIsoDate(fallbackYear, monthDay[1], monthDay[2]);

  const compactMonthDay = text.match(/(?:^|[^\d])(\d{2})(\d{2})(?:[^\d]|$)/);
  if (compactMonthDay) return validIsoDate(fallbackYear, compactMonthDay[1], compactMonthDay[2]);

  return null;
}

export function formatGalleryDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

export function cleanGalleryAlbumTitle(folderName: string, date: string) {
  const compactDate = date.slice(5).replace("-", "");
  return folderName
    .replace(new RegExp(`^${date}\\s*[-_·]*\\s*`), "")
    .replace(new RegExp(`^${compactDate}\\s*[-_·]*\\s*`), "")
    .trim() || formatGalleryDateLabel(date);
}
