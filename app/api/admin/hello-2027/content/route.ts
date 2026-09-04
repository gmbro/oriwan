import { NextRequest, NextResponse } from "next/server";

import { requireAdminDataAccess } from "@/lib/admin-data-access";
import {
  HELLO_2027_SEASON_KEY,
  isHello2027ContentType,
  isHello2027MobileFocus,
  isSafeHello2027ImageUrl,
  MAX_BANNER_ALT_LENGTH,
  MAX_BANNER_DESCRIPTION_LENGTH,
  MAX_BANNER_OWNER_LENGTH,
  MAX_BANNER_TITLE_LENGTH,
  MAX_ENCOURAGEMENT_LENGTH,
  MAX_HELLO_2027_BANNERS,
  MAX_HELLO_2027_ENCOURAGEMENTS,
  normalizeContentText,
  type Hello2027ContentType,
} from "@/lib/hello-2027-content";
import { guardMutationRequest, guardReadRequest } from "@/lib/request-security";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
};

type JsonBody = Record<string, unknown>;
type BodyReadResult =
  | { ok: true; body: JsonBody }
  | { ok: false; response: NextResponse };

function json(payload: object, init?: { status?: number }) {
  return NextResponse.json(payload, {
    status: init?.status,
    headers: PRIVATE_HEADERS,
  });
}

function tableFor(type: Hello2027ContentType) {
  return type === "encouragement" ? "hello_2027_encouragements" : "hello_2027_banners";
}

function maxItemsFor(type: Hello2027ContentType) {
  return type === "encouragement" ? MAX_HELLO_2027_ENCOURAGEMENTS : MAX_HELLO_2027_BANNERS;
}

function selectFor(type: Hello2027ContentType) {
  return type === "encouragement"
    ? "id, message, display_order, active, created_at, updated_at"
    : "id, owner_name, title, description, alt_text, image_url, mobile_focus, display_order, active, created_at, updated_at";
}

function schemaError(type: Hello2027ContentType) {
  const subject = type === "encouragement" ? "응원글" : "배너";
  return json(missingSchemaResponse(`${subject} 저장소가 아직 준비되지 않았어요.`), { status: 503 });
}

function databaseError(type: Hello2027ContentType, action: string, error: unknown) {
  if (isMissingTableError(error)) return schemaError(type);
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "unknown")
    : "unknown";
  console.error(`Hello 2027 admin ${type} ${action} failed (code: ${code}).`);
  const actionLabel = action === "read" ? "불러오지" : action === "delete" ? "삭제하지" : "저장하지";
  return json({ error: `콘텐츠를 ${actionLabel} 못했어요.` }, { status: 500 });
}

async function readBody(request: NextRequest, maxBytes: number): Promise<BodyReadResult> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, response: json({ error: "요청 내용을 확인해주세요." }, { status: 400 }) };
  }

  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
    return { ok: false, response: json({ error: "요청 용량이 너무 커요. 내용을 줄여 다시 시도해주세요." }, { status: 413 }) };
  }

  try {
    const value: unknown = JSON.parse(rawBody);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, response: json({ error: "요청 내용을 확인해주세요." }, { status: 400 }) };
    }
    return { ok: true, body: value as JsonBody };
  } catch {
    return { ok: false, response: json({ error: "요청 내용을 확인해주세요." }, { status: 400 }) };
  }
}

function readDisplayOrder(value: unknown, fallback?: number) {
  if (value === undefined && fallback !== undefined) return fallback;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10_000
    ? value
    : null;
}

function readActive(value: unknown, fallback?: boolean) {
  if (value === undefined && fallback !== undefined) return fallback;
  return typeof value === "boolean" ? value : null;
}

function parseTypeFromBody(body: JsonBody | null) {
  return body && isHello2027ContentType(body.type) ? body.type : null;
}

function getContentTypeError() {
  return json({ error: "콘텐츠 종류는 encouragement 또는 banner로 지정해주세요." }, { status: 400 });
}

function validateEncouragement(body: JsonBody, partial: boolean) {
  const patch: Record<string, string | number | boolean> = {};

  if (!partial || Object.hasOwn(body, "message")) {
    const message = normalizeContentText(body.message, MAX_ENCOURAGEMENT_LENGTH);
    if (!message) return { error: `응원글은 1~${MAX_ENCOURAGEMENT_LENGTH}자의 일반 텍스트로 입력해주세요.` };
    patch.message = message;
  }
  if (!partial || Object.hasOwn(body, "display_order")) {
    const displayOrder = readDisplayOrder(body.display_order, partial ? undefined : 0);
    if (displayOrder === null) return { error: "노출 순서는 0~10000 사이의 정수로 입력해주세요." };
    patch.display_order = displayOrder;
  }
  if (!partial || Object.hasOwn(body, "active")) {
    const active = readActive(body.active, partial ? undefined : true);
    if (active === null) return { error: "활성 상태를 다시 확인해주세요." };
    patch.active = active;
  }

  if (partial && Object.keys(patch).length === 0) return { error: "수정할 응원글 정보가 없어요." };
  return { patch };
}

function validateBanner(body: JsonBody, partial: boolean) {
  const patch: Record<string, string | number | boolean> = {};
  const textFields = [
    ["owner_name", MAX_BANNER_OWNER_LENGTH, "광고주"],
    ["title", MAX_BANNER_TITLE_LENGTH, "제목"],
    ["description", MAX_BANNER_DESCRIPTION_LENGTH, "설명"],
    ["alt_text", MAX_BANNER_ALT_LENGTH, "이미지 대체문구"],
  ] as const;

  for (const [field, maxLength, label] of textFields) {
    if (partial && !Object.hasOwn(body, field)) continue;
    const value = normalizeContentText(body[field], maxLength);
    if (!value) return { error: `${label}은 1~${maxLength}자의 일반 텍스트로 입력해주세요.` };
    patch[field] = value;
  }

  if (!partial || Object.hasOwn(body, "image_url")) {
    if (!isSafeHello2027ImageUrl(body.image_url)) {
      return { error: "이미지는 /로 시작하는 사이트 내부 경로 또는 Supabase public Storage URL만 사용할 수 있어요." };
    }
    patch.image_url = body.image_url.trim();
  }
  if (!partial || Object.hasOwn(body, "mobile_focus")) {
    const focus = body.mobile_focus === undefined && !partial ? "center" : body.mobile_focus;
    if (!isHello2027MobileFocus(focus)) {
      return { error: "모바일 이미지 초점은 left, center, right 중에서 선택해주세요." };
    }
    patch.mobile_focus = focus;
  }
  if (!partial || Object.hasOwn(body, "display_order")) {
    const displayOrder = readDisplayOrder(body.display_order, partial ? undefined : 0);
    if (displayOrder === null) return { error: "노출 순서는 0~10000 사이의 정수로 입력해주세요." };
    patch.display_order = displayOrder;
  }
  if (!partial || Object.hasOwn(body, "active")) {
    const active = readActive(body.active, partial ? undefined : true);
    if (active === null) return { error: "활성 상태를 다시 확인해주세요." };
    patch.active = active;
  }

  if (partial && Object.keys(patch).length === 0) return { error: "수정할 배너 정보가 없어요." };
  return { patch };
}

function validateContent(type: Hello2027ContentType, body: JsonBody, partial: boolean) {
  return type === "encouragement"
    ? validateEncouragement(body, partial)
    : validateBanner(body, partial);
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    requireSameOrigin: true,
    rateLimit: { key: "admin-hello-2027-content-read", limit: 180, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;
  const typeValue = request.nextUrl.searchParams.get("type");
  if (!isHello2027ContentType(typeValue)) return getContentTypeError();

  const { data, error } = await service
    .from(tableFor(typeValue))
    .select(selectFor(typeValue))
    .eq("user_id", user.id)
    .eq("season_key", HELLO_2027_SEASON_KEY)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(maxItemsFor(typeValue));

  if (error) return databaseError(typeValue, "read", error);
  return json({ items: data || [] });
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 12 * 1024,
    rateLimit: { key: "admin-hello-2027-content-write", limit: 60, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;
  const bodyResult = await readBody(request, 12 * 1024);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;
  const type = parseTypeFromBody(body);
  if (!type) return getContentTypeError();

  const validation = validateContent(type, body, false);
  if ("error" in validation) return json({ error: validation.error }, { status: 400 });

  const table = tableFor(type);
  const { count, error: countError } = await service
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("season_key", HELLO_2027_SEASON_KEY);

  if (countError) return databaseError(type, "create", countError);
  if ((count || 0) >= maxItemsFor(type)) {
    return json({ error: `${type === "encouragement" ? "응원글" : "배너"}은 최대 ${maxItemsFor(type)}개까지 등록할 수 있어요.` }, { status: 409 });
  }

  const { data, error } = await service
    .from(table)
    .insert({
      ...validation.patch,
      user_id: user.id,
      season_key: HELLO_2027_SEASON_KEY,
      updated_at: new Date().toISOString(),
    })
    .select(selectFor(type))
    .single();

  if (error?.code === "23505") return json({ error: "같은 응원글이 이미 등록되어 있어요." }, { status: 409 });
  if (error?.code === "23514") return json({ error: "등록 가능한 콘텐츠 수를 초과했어요." }, { status: 409 });
  if (error) return databaseError(type, "create", error);
  return json({ item: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 12 * 1024,
    rateLimit: { key: "admin-hello-2027-content-write", limit: 60, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;
  const bodyResult = await readBody(request, 12 * 1024);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;
  const type = parseTypeFromBody(body);
  if (!type) return getContentTypeError();
  if (typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) {
    return json({ error: "수정할 콘텐츠를 다시 선택해주세요." }, { status: 400 });
  }

  const validation = validateContent(type, body, true);
  if ("error" in validation) return json({ error: validation.error }, { status: 400 });

  const { data, error } = await service
    .from(tableFor(type))
    .update({ ...validation.patch, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .eq("season_key", HELLO_2027_SEASON_KEY)
    .select(selectFor(type))
    .maybeSingle();

  if (error?.code === "23505") return json({ error: "같은 응원글이 이미 등록되어 있어요." }, { status: 409 });
  if (error) return databaseError(type, "update", error);
  if (!data) return json({ error: "수정할 콘텐츠를 찾지 못했어요." }, { status: 404 });
  return json({ item: data });
}

export async function DELETE(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 1_024,
    rateLimit: { key: "admin-hello-2027-content-write", limit: 60, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;
  const typeValue = request.nextUrl.searchParams.get("type");
  const id = request.nextUrl.searchParams.get("id");
  if (!isHello2027ContentType(typeValue)) return getContentTypeError();
  if (!id || !UUID_PATTERN.test(id)) return json({ error: "삭제할 콘텐츠를 다시 선택해주세요." }, { status: 400 });

  const { data, error } = await service
    .from(tableFor(typeValue))
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("season_key", HELLO_2027_SEASON_KEY)
    .select("id")
    .maybeSingle();

  if (error) return databaseError(typeValue, "delete", error);
  if (!data) return json({ error: "삭제할 콘텐츠를 찾지 못했어요." }, { status: 404 });
  return json({ ok: true });
}
