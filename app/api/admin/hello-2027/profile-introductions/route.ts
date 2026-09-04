import { NextRequest, NextResponse } from "next/server";

import { requireAdminDataAccess } from "@/lib/admin-data-access";
import {
  HELLO_2027_SEASON_KEY,
  MAX_HELLO_2027_PROFILE_INTRODUCTIONS,
  MAX_PROFILE_INTRO_LENGTH,
  MAX_PROFILE_INTRO_NAME_LENGTH,
  MAX_PROFILE_INTRO_TITLE_LENGTH,
  normalizeContentText,
} from "@/lib/hello-2027-content";
import { guardMutationRequest, guardReadRequest } from "@/lib/request-security";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8 * 1024;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

type JsonBody = Record<string, unknown>;
type ParticipantRow = {
  id: string;
  name: string;
};
type IntroductionRow = {
  participant_id: string;
  name_snapshot: string | null;
  title: string;
  body: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function json(payload: object, status = 200) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}

function setupRequired() {
  return json(missingSchemaResponse("4기 크루 자기소개 저장소가 아직 준비되지 않았어요."), 503);
}

function logDatabaseFailure(action: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "unknown")
    : "unknown";
  console.error(`Hello 2027 admin profile introduction ${action} failed (code: ${code}).`);
}

async function readBody(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return { ok: false as const, response: json({ error: "요청 내용을 확인해주세요." }, 400) };
  }

  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return { ok: false as const, response: json({ error: "요청 용량이 너무 커요." }, 413) };
  }

  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false as const, response: json({ error: "요청 내용을 확인해주세요." }, 400) };
    }
    return { ok: true as const, body: parsed as JsonBody };
  } catch {
    return { ok: false as const, response: json({ error: "요청 내용을 확인해주세요." }, 400) };
  }
}

function defaultTitle(name: string) {
  return normalizeContentText(`${name}의 한마디`, MAX_PROFILE_INTRO_TITLE_LENGTH) || "크루의 한마디";
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    requireSameOrigin: true,
    rateLimit: { key: "admin-hello-2027-profile-introductions-read", limit: 120, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;

  const [participantResult, introductionResult] = await Promise.all([
    service
      .from("participants")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("season_key", HELLO_2027_SEASON_KEY)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(MAX_HELLO_2027_PROFILE_INTRODUCTIONS),
    service
      .from("hello_2027_profile_introductions")
      .select("participant_id, name_snapshot, title, body, active, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("season_key", HELLO_2027_SEASON_KEY)
      .limit(MAX_HELLO_2027_PROFILE_INTRODUCTIONS),
  ]);

  if (participantResult.error || introductionResult.error) {
    const error = participantResult.error || introductionResult.error;
    if (isMissingTableError(error)) return setupRequired();
    logDatabaseFailure("read", error);
    return json({ error: "크루 자기소개를 불러오지 못했어요." }, 500);
  }

  const introductionByParticipant = new Map(
    ((introductionResult.data || []) as IntroductionRow[]).map((item) => [item.participant_id, item]),
  );
  const items = ((participantResult.data || []) as ParticipantRow[]).map((participant) => {
    const introduction = introductionByParticipant.get(participant.id);
    const name = normalizeContentText(participant.name, MAX_PROFILE_INTRO_NAME_LENGTH) || "이름 확인 필요";
    return {
      participant_id: participant.id,
      name,
      title: introduction?.title || defaultTitle(name),
      body: introduction?.body || "",
      active: introduction?.active === true,
      created_at: introduction?.created_at || null,
      updated_at: introduction?.updated_at || null,
    };
  });

  return json({ items });
}

export async function PUT(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: MAX_BODY_BYTES,
    rateLimit: { key: "admin-hello-2027-profile-introductions-write", limit: 60, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;

  const bodyResult = await readBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;
  const participantId = typeof body.participant_id === "string" ? body.participant_id : "";
  const title = normalizeContentText(body.title, MAX_PROFILE_INTRO_TITLE_LENGTH);
  const active = typeof body.active === "boolean" ? body.active : null;
  const rawIntroduction = typeof body.body === "string" ? body.body.trim() : null;
  const introduction = rawIntroduction
    ? normalizeContentText(rawIntroduction, MAX_PROFILE_INTRO_LENGTH)
    : rawIntroduction === ""
      ? ""
      : null;

  if (!UUID_PATTERN.test(participantId)) {
    return json({ error: "자기소개를 저장할 크루를 다시 선택해주세요." }, 400);
  }
  if (!title) {
    return json({ error: `자기소개 제목은 1~${MAX_PROFILE_INTRO_TITLE_LENGTH}자로 입력해주세요.` }, 400);
  }
  if (active === null) {
    return json({ error: "자기소개 공개 상태를 다시 확인해주세요." }, 400);
  }
  if (introduction === null || (active && !introduction)) {
    return json({ error: `공개할 자기소개는 1~${MAX_PROFILE_INTRO_LENGTH}자로 입력해주세요.` }, 400);
  }

  const { data: participant, error: participantError } = await service
    .from("participants")
    .select("id, name")
    .eq("id", participantId)
    .eq("user_id", user.id)
    .eq("season_key", HELLO_2027_SEASON_KEY)
    .eq("active", true)
    .maybeSingle();

  if (participantError) {
    if (isMissingTableError(participantError)) return setupRequired();
    logDatabaseFailure("participant lookup", participantError);
    return json({ error: "크루 정보를 확인하지 못했어요." }, 500);
  }
  if (!participant) return json({ error: "활성 크루를 찾지 못했어요." }, 404);

  const participantName = normalizeContentText(participant.name, MAX_PROFILE_INTRO_NAME_LENGTH);
  if (!participantName) {
    return json({ error: `크루 이름을 1~${MAX_PROFILE_INTRO_NAME_LENGTH}자로 먼저 정리해주세요.` }, 409);
  }

  const now = new Date().toISOString();
  const { data, error } = await service
    .from("hello_2027_profile_introductions")
    .upsert({
      user_id: user.id,
      season_key: HELLO_2027_SEASON_KEY,
      participant_id: participant.id,
      name_snapshot: participantName,
      title,
      body: introduction,
      active,
      updated_at: now,
    }, { onConflict: "user_id,season_key,participant_id" })
    .select("participant_id, name_snapshot, title, body, active, created_at, updated_at")
    .single();

  if (error) {
    if (isMissingTableError(error)) return setupRequired();
    if (error.code === "23514") {
      return json({ error: `4기 공개 자기소개는 최대 ${MAX_HELLO_2027_PROFILE_INTRODUCTIONS}개까지 저장할 수 있어요.` }, 409);
    }
    logDatabaseFailure("write", error);
    return json({ error: "크루 자기소개를 저장하지 못했어요." }, 500);
  }

  const item = data as IntroductionRow;
  return json({
    item: {
      participant_id: item.participant_id,
      name: participantName,
      title: item.title,
      body: item.body,
      active: item.active,
      created_at: item.created_at,
      updated_at: item.updated_at,
    },
  });
}
