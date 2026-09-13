import { MEMBER_UPLOAD_BUCKET } from "@/lib/member-upload-contract";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const MEMBER_IMAGE = new RegExp(`^${MEMBER_UPLOAD_BUCKET}/(4th/${UUID}/\\d{4}-\\d{2}-\\d{2}/[a-f0-9]{64}/image\\.webp)$`, "i");
const LEGACY_IMAGE = new RegExp(`^run-records/(?:(3th|4th)/)?(${UUID})/${UUID}/[0-9-]+\\.(jpg|jpeg|png|webp)$`, "i");

/** Only database-bound certification paths, never URLs or arbitrary Storage objects. */
export function getPrivateRunImageLocation(imagePath: unknown, ownerId: string, seasonKey: string) {
  if (typeof imagePath !== "string") return null;
  const member = imagePath.match(MEMBER_IMAGE);
  if (member && seasonKey === "4th") {
    return { bucket: MEMBER_UPLOAD_BUCKET, path: member[1], contentType: "image/webp", extension: "webp" };
  }
  const legacy = imagePath.match(LEGACY_IMAGE);
  if (!legacy || legacy[2] !== ownerId || (legacy[1] ?? "3th") !== seasonKey) return null;
  const extension = legacy[3].toLowerCase();
  return {
    bucket: "photos",
    path: imagePath,
    contentType: extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`,
    extension,
  };
}
