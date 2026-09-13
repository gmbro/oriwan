import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { resolvePersonalMemberContext } from "@/lib/personal-member-context";
import { guardMutationRequest, guardReadRequest, readLimitedJson } from "@/lib/request-security";
import { logServerFailure } from "@/lib/server-error-log";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import {
  getTimeMachineTiming,
  parseTimeMachineGoalInput,
  TIME_MACHINE_SEASON_KEY,
} from "@/lib/time-machine-contract";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

type TimeMachineContext = {
  service: SupabaseClient;
  authUserId: string;
  adminUserId: string;
  participantId: string;
};

type TimeMachineGoalRow = {
  id: string;
  goal_title: string;
  goal_detail: string;
  commitment: string;
  created_at: string;
};

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}

async function resolveTimeMachineContext(): Promise<TimeMachineContext | NextResponse> {
  const resolution = await resolvePersonalMemberContext();
  if (!resolution.ok) {
    if (resolution.reason === "configuration_unavailable") {
      return json({ error: "카카오 로그인 서버 설정이 아직 준비되지 않았어요." }, 503);
    }
    if (resolution.reason === "unauthenticated") {
      return json({ error: "목표 타임머신은 카카오 로그인 후 이용할 수 있어요." }, 401);
    }
    return json({ error: "운영 서버 연결이 아직 준비되지 않았어요." }, 503);
  }

  const { authUserId, service, connection } = resolution;
  if (connection.status !== "approved" || !connection.adminUserId || !connection.participant) {
    return json({
      error: "개인 멤버 연결을 완료하지 못했어요. 잠시 후 다시 확인해주세요.",
      connection_status: connection.status,
    }, 403);
  }
  return {
    service,
    authUserId,
    adminUserId: connection.adminUserId,
    participantId: connection.participant.id,
  };
}

async function readGoal(context: TimeMachineContext) {
  return context.service
    .from("time_machine_goals")
    .select("id, goal_title, goal_detail, commitment, created_at")
    .eq("season_key", TIME_MACHINE_SEASON_KEY)
    .eq("auth_user_id", context.authUserId)
    .eq("user_id", context.adminUserId)
    .maybeSingle();
}

function missingTableResponse() {
  return json({
    ...missingSchemaResponse("목표 타임머신 저장소가 아직 준비되지 않았어요."),
    setup_file: "docs/migrations/2026-09-07-time-machine-goals.sql",
  }, 503);
}

function serializeGoal(row: TimeMachineGoalRow | null) {
  const timing = getTimeMachineTiming();
  if (!row) return { state: "empty", ...timing };

  // The server, not CSS or a client clock, is the gate for sealed goal contents.
  if (!timing.unlocked) return { state: "locked", ...timing, created_at: row.created_at };
  return {
    state: "opened",
    ...timing,
    goal: {
      title: row.goal_title,
      detail: row.goal_detail,
      commitment: row.commitment,
      created_at: row.created_at,
    },
  };
}

async function readJsonBody(request: NextRequest) {
  const parsed = await readLimitedJson(request, MAX_BODY_BYTES);
  if (!parsed.ok) return parsed;
  return { ok: true as const, body: parsed.value };
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    requireSameOrigin: true,
    rateLimit: { key: "time-machine-read", limit: 30, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  try {
    const context = await resolveTimeMachineContext();
    if (context instanceof NextResponse) return context;
    const { data, error } = await readGoal(context);
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse();
      throw error;
    }
    return json(serializeGoal((data as TimeMachineGoalRow | null) ?? null));
  } catch (error) {
    logServerFailure("Time machine goal read", error);
    return json({ error: "목표 타임머신을 불러오지 못했어요." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: MAX_BODY_BYTES,
    rateLimit: {
      key: "time-machine-create",
      limit: 5,
      windowMs: 60_000,
      message: "타임머신 발동 요청이 잠시 몰렸어요. 잠시 후 다시 시도해주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  try {
    const context = await resolveTimeMachineContext();
    if (context instanceof NextResponse) return context;
    if (getTimeMachineTiming().unlocked) {
      return json({ error: "타임머신이 이미 열렸어요. 다음 목표 상자를 기다려주세요." }, 403);
    }
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) return bodyResult.response;
    const parsed = parseTimeMachineGoalInput(bodyResult.body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    const { data, error } = await context.service
      .from("time_machine_goals")
      .insert({
        season_key: TIME_MACHINE_SEASON_KEY,
        user_id: context.adminUserId,
        participant_id: context.participantId,
        auth_user_id: context.authUserId,
        goal_title: parsed.value.goal_title,
        goal_detail: parsed.value.goal_detail,
        commitment: parsed.value.commitment,
      })
      .select("id, goal_title, goal_detail, commitment, created_at")
      .single();
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse();
      if (error.code === "23505") return json({ error: "이미 목표 타임머신을 발동했어요." }, 409);
      throw error;
    }
    return json(serializeGoal(data as TimeMachineGoalRow), 201);
  } catch (error) {
    logServerFailure("Time machine goal create", error);
    return json({ error: "목표 타임머신을 발동하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }
}
