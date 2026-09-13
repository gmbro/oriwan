import { NextRequest, NextResponse } from "next/server";
import { findAdminUserId, getServiceClient } from "@/lib/admin-data";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { memberJson } from "@/lib/member-upload-server";
import { resolvePersonalKakaoIdentity } from "@/lib/personal-member-context";
import { getPrivateRunImageLocation } from "@/lib/private-run-image";
import { guardReadRequest } from "@/lib/request-security";
import { isSupportedRasterSignature } from "@/lib/image-signature";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = guardReadRequest(request, { rateLimit: { key: "private-run-image", limit: 90, windowMs: 60_000 } });
  if (guard) return guard;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return memberJson({ error: "기록을 찾을 수 없어요." }, 404);
  }
  try {
    const admin = await requireAdminDataAccess();
    const identity = admin.ok ? null : await resolvePersonalKakaoIdentity();
    if (!admin.ok && (!identity || !identity.ok)) return memberJson({ error: "로그인이 필요해요." }, 401);
    const service = admin.ok ? admin.service : getServiceClient();
    if (!service) return memberJson({ error: "사진 저장소를 연결하지 못했어요." }, 503);
    const ownerId = admin.ok ? admin.user.id : await findAdminUserId(service);
    if (!ownerId) return memberJson({ error: "사진을 찾을 수 없어요." }, 404);

    // Authorize the database record, including legacy seasons. Never accept a
    // participant ID or storage path supplied by the browser.
    const { data: record, error } = await service.from("daily_run_records")
      .select("image_url, participant_id, season_key")
      .eq("id", id).eq("user_id", ownerId).maybeSingle();
    if (error || !record) return memberJson({ error: "사진을 찾을 수 없어요." }, 404);
    if (!admin.ok) {
      if (!identity?.ok || !record.participant_id) return memberJson({ error: "사진을 찾을 수 없어요." }, 404);
      const { data: account, error: accountError } = await service.from("participant_accounts")
        .select("participant_id, participant:participants!participant_accounts_participant_id_fkey(id,user_id,season_key,active)")
        .eq("auth_user_id", identity.authUserId).eq("season_key", record.season_key)
        .eq("status", "approved").eq("participant_id", record.participant_id).maybeSingle();
      const participant = Array.isArray(account?.participant) ? account.participant[0] : account?.participant;
      if (accountError || !participant || !participant.active || participant.id !== record.participant_id
        || participant.user_id !== ownerId || participant.season_key !== record.season_key) {
        return memberJson({ error: "사진을 찾을 수 없어요." }, 404);
      }
    }

    const location = getPrivateRunImageLocation(record.image_url, ownerId, record.season_key);
    if (!location) return memberJson({ error: "사진을 찾을 수 없어요." }, 404);
    const image = await service.storage.from(location.bucket).download(location.path);
    if (image.error || !image.data) return memberJson({ error: "사진을 불러오지 못했어요." }, 404);
    if (image.data.size > 4 * 1024 * 1024) return memberJson({ error: "사진 용량을 확인해주세요." }, 413);
    const bytes = new Uint8Array(await image.data.arrayBuffer());
    if (!isSupportedRasterSignature(bytes, location.contentType)) return memberJson({ error: "사진 형식을 확인해주세요." }, 415);
    return new NextResponse(bytes, { headers: {
      "Content-Type": location.contentType,
      "Content-Disposition": `inline; filename="certification-${id}.${location.extension}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'",
      Vary: "Cookie", "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return memberJson({ error: "사진을 불러오지 못했어요. 잠시 후 다시 시도해주세요." }, 503);
  }
}
