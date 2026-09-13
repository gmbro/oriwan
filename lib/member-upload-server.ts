import "server-only";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePersonalMemberContext } from "@/lib/personal-member-context";
import { MEMBER_UPLOAD_BUCKET, MEMBER_UPLOAD_DAILY_LIMIT, type MemberUploadDraft } from "@/lib/member-upload-contract";

export function memberJson(payload: object, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
export async function readMemberJson(request: NextRequest, limit = 4096) {
  const reader = request.body?.getReader();
  if (!reader) return { response: memberJson({ error: "입력 내용을 확인해주세요." }, 400) };
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return { response: memberJson({ error: "입력 용량이 너무 커요." }, 413) }; }
      chunks.push(value);
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("object_required");
    return { body: body as Record<string, unknown> };
  } catch { return { response: memberJson({ error: "입력 내용을 확인해주세요." }, 400) }; }
}
export async function ownedMember() {
  const context = await resolvePersonalMemberContext();
  if (!context.ok) return { response: memberJson({ error: "카카오 로그인을 확인해주세요." }, context.reason === "unauthenticated" ? 401 : 503) };
  const { connection } = context;
  if (connection.status !== "approved" || !connection.participant || !connection.adminUserId) return { response: memberJson({ error: "연결된 멤버 계정이 필요해요." }, 403) };
  return { context, participantId: connection.participant.id, adminUserId: connection.adminUserId };
}
// Service-only bucket. Never change an existing bucket's visibility implicitly.
export async function privateUploadStore(service: SupabaseClient) {
  let { data, error } = await service.storage.getBucket(MEMBER_UPLOAD_BUCKET);
  if (error && (String(error.statusCode) === "404" || /not found/i.test(error.message))) {
    const created = await service.storage.createBucket(MEMBER_UPLOAD_BUCKET, { public: false, fileSizeLimit: 4 * 1024 * 1024, allowedMimeTypes: ["image/webp", "application/json"] });
    if (created.error && !/already exists|duplicate/i.test(created.error.message)) throw created.error;
    ({ data, error } = await service.storage.getBucket(MEMBER_UPLOAD_BUCKET));
  }
  if (error || !data || data.public) throw new Error("Private upload storage unavailable");
  return service.storage.from(MEMBER_UPLOAD_BUCKET);
}
export function uploadPrefix(authUserId: string, draftId: string) { return `4th/${authUserId}/${draftId}`; }
export async function readUploadDraft(store: Awaited<ReturnType<typeof privateUploadStore>>, prefix: string) {
  const result = await store.download(`${prefix}/draft.json`);
  if (result.error || !result.data) return null;
  return JSON.parse(await result.data.text()) as MemberUploadDraft;
}
export async function reserveOcrQuota(store: Awaited<ReturnType<typeof privateUploadStore>>, authUserId: string, date: string) {
  // Atomic Storage INSERTs keep the daily budget durable across instances.
  // Failed/ambiguous OCR calls consume a slot too; never auto-retry a paid call.
  for (let slot = 1; slot <= MEMBER_UPLOAD_DAILY_LIMIT; slot++) {
    const { error } = await store.upload(`quota/${authUserId}/${date}/${slot}.json`, "{}", { contentType: "application/json", upsert: false });
    if (!error) return true;
    if (!/duplicate|already exists/i.test(error.message) && String(error.statusCode) !== "409") throw error;
  }
  return false;
}
