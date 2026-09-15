import { privateUploadStore } from "@/lib/member-upload-server";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { guardMutationRequest, guardReadRequest, readLimitedJson } from "@/lib/request-security";
import { parseSeasonEvent } from "@/lib/season-schedule-contract";
import { EVENT_ID, readSeasonEvents, scheduleDirectory } from "@/lib/season-schedule-storage";
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: NextRequest) {
  const guard = guardReadRequest(request, { requireSameOrigin: true }); if (guard) return guard;
  const access = await requireAdminDataAccess(); if (!access.ok) return access.response;
  try { return json({ items: await readSeasonEvents(access.service, access.user.id) }); }
  catch { return json({ error: "일정을 불러오지 못했어요." }, 503); }
}
export async function POST(request: NextRequest) {
  const guard = guardMutationRequest(request, { maxBodyBytes: 16384, rateLimit: { key: "schedule-write", limit: 30, windowMs: 60000 } }); if (guard) return guard;
  const access = await requireAdminDataAccess(); if (!access.ok) return access.response;
  const body = await readLimitedJson(request, 16384); if (!body.ok) return body.response;
  const event = parseSeasonEvent(body.value);
  if (!event) return json({ error: "2026년 9월~2027년 1월 1일 날짜와 제목, 시간 형식을 확인해주세요." }, 400);
  const id = body.value.id === undefined ? randomUUID() : body.value.id;
  if (typeof id !== "string" || !EVENT_ID.test(id)) return json({ error: "일정 번호가 올바르지 않아요." }, 400);
  const { error } = await (await privateUploadStore(access.service)).upload(`${scheduleDirectory(access.user.id)}/${id}.txt`, JSON.stringify(event), { upsert: true, contentType: "application/json" });
  return error ? json({ error: "저장하지 못했어요. 입력 내용은 유지됩니다." }, 503) : json({ item: { id, ...event } });
}
export async function DELETE(request: NextRequest) {
  const guard = guardMutationRequest(request, { rateLimit: { key: "schedule-delete", limit: 30, windowMs: 60000 } }); if (guard) return guard;
  const access = await requireAdminDataAccess(); if (!access.ok) return access.response;
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !EVENT_ID.test(id)) return json({ error: "일정 번호가 올바르지 않아요." }, 400);
  const { error } = await (await privateUploadStore(access.service)).remove([`${scheduleDirectory(access.user.id)}/${id}.txt`]);
  return error ? json({ error: "삭제하지 못했어요." }, 503) : json({ ok: true });
}
