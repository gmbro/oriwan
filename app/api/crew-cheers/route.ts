import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/admin-data";
import { privateUploadStore } from "@/lib/member-upload-server";
import { certificationDay } from "@/lib/certification-ui";
import { isCrewCheerType } from "@/lib/crew-cheers";
import { guardMutationRequest, guardReadRequest, readLimitedJson } from "@/lib/request-security";
export const dynamic = "force-dynamic";
const cookieName = "twtt-crew-visitor";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers });
async function handle(request: NextRequest, send: boolean) {
  const guard = send
    ? guardMutationRequest(request, { maxBodyBytes: 1024, rateLimit: { key: "crew-cheer-send", limit: 12, windowMs: 60_000 } })
    : guardReadRequest(request, { requireSameOrigin: true, rateLimit: { key: "crew-cheer-read", limit: 60, windowMs: 60_000 } });
  if (guard) return guard;
  try {
    const auth = await createClient();
    const { data } = await auth.auth.getClaims();
    if (data?.claims?.sub) return json({ visible: false }, send ? 403 : 200);
    let reaction: string | null = null;
    if (send) {
      const parsed = await readLimitedJson(request, 1024);
      if (!parsed.ok) return parsed.response;
      if (!isCrewCheerType(parsed.value.type)) return json({ error: "응원 이모지를 선택해주세요." }, 400);
      reaction = parsed.value.type;
    }
    const raw = request.cookies.get(cookieName)?.value;
    if (send && (!raw || !uuid.test(raw))) return json({ error: "응원 상태를 다시 확인해주세요." }, 409);
    const visitor = raw && uuid.test(raw) ? raw : randomUUID();
    const day = certificationDay();
    const service = getServiceClient();
    if (!service) throw new Error("unavailable");
    const store = await privateUploadStore(service);
    // One immutable private object per visitor/day; concurrent requests cannot add duplicates.
    const visitorHash = createHash("sha256").update(visitor).digest("hex");
    const path = `crew-cheers/${process.env.NODE_ENV === "development" ? "local" : "live"}/4th/${day}/${visitorHash}.json`;
    let sent = false;
    if (send) {
      const result = await store.upload(path, JSON.stringify({ season: "4th", day, visitorHash, type: reaction, createdAt: new Date().toISOString() }), { contentType: "application/json", upsert: false });
      if (result.error && !/duplicate|already exists/i.test(result.error.message) && String((result.error as { statusCode?: string }).statusCode) !== "409") throw result.error;
      if (result.error) {
        const previous=await store.download(path);
        if (previous.error) throw previous.error;
        reaction=JSON.parse(await previous.data.text()).type;
      }
      sent = true;
    } else {
      const result = await store.download(path);
      if (result.error && !/not found|does not exist/i.test(result.error.message) && String((result.error as { statusCode?: string }).statusCode) !== "404") throw result.error;
      sent = !result.error;
      if (sent && result.data) reaction=JSON.parse(await result.data.text()).type;
    }
    const response = json({ visible: true, sent, day, reaction });
    response.cookies.set(cookieName, visitor, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 365 * 86400 });
    return response;
  } catch { return json({ error: "응원을 보내지 못했어요. 잠시 후 다시 시도해주세요." }, 503); }
}
export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);
