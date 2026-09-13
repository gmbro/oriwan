import { after } from "next/server";
import { invalidatePublicDashboardCache } from "@/lib/public-dashboard-data";
import { broadcastDashboardRefreshFromServer } from "@/lib/dashboard-refresh-server";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { guardMutationRequest, guardReadRequest, readLimitedJson } from "@/lib/request-security";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";
import {
  parseTimeMachineResetInput,
  TIME_MACHINE_SEASON_KEY,
} from "@/lib/time-machine-contract";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024;
const MAX_GOALS = 100;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

type TimeMachineGoalRow = {
  id: string;
  participant_id: string;
  goal_title: string;
  goal_detail: string;
  commitment: string;
  created_at: string;
  unlock_at: string;
};

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}

function missingTableResponse() {
  return json({
    ...missingSchemaResponse("목표 타임머신 저장소가 아직 준비되지 않았어요."),
    setup_file: "docs/migrations/2026-09-07-time-machine-goals.sql",
  }, 503);
}

function logDatabaseFailure(action: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "unknown")
    : "unknown";
  console.error(`Hello 2027 admin time machine ${action} failed (code: ${code}).`);
}

async function readJsonBody(request: NextRequest) {
  const parsed = await readLimitedJson(request, MAX_BODY_BYTES);
  if (!parsed.ok) return parsed;
  return { ok: true as const, value: parsed.value };
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    requireSameOrigin: true,
    rateLimit: { key: "admin-hello-2027-time-machine-read", limit: 120, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;

  const { data, error } = await service
    .from("time_machine_goals")
    .select("id, participant_id, goal_title, goal_detail, commitment, created_at, unlock_at")
    .eq("user_id", user.id)
    .eq("season_key", TIME_MACHINE_SEASON_KEY)
    .order("created_at", { ascending: false })
    .limit(MAX_GOALS);

  if (error) {
    if (isMissingTableError(error)) return missingTableResponse();
    logDatabaseFailure("read", error);
    return json({ error: "크루의 목표 타임머신을 불러오지 못했어요." }, 500);
  }

  const now = Date.now();
  const items = ((data || []) as TimeMachineGoalRow[]).map((item) => ({
    id: item.id,
    participant_id: item.participant_id,
    goal_title: item.goal_title,
    goal_detail: item.goal_detail,
    commitment: item.commitment,
    created_at: item.created_at,
    unlock_at: item.unlock_at,
    status: now >= Date.parse(item.unlock_at) ? "opened" : "sealed",
  }));

  return json({ items });
}

export async function DELETE(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: MAX_BODY_BYTES,
    rateLimit: {
      key: "admin-hello-2027-time-machine-reset",
      limit: 20,
      windowMs: 60_000,
      message: "재설정 요청이 잠시 몰렸어요. 잠시 후 다시 시도해주세요.",
    },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user, service } = access;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = parseTimeMachineResetInput(bodyResult.value);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const { data, error } = await service
    .from("time_machine_goals")
    .delete()
    .eq("id", parsed.value.goal_id)
    .eq("user_id", user.id)
    .eq("season_key", TIME_MACHINE_SEASON_KEY)
    .select("id, participant_id")
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return missingTableResponse();
    logDatabaseFailure("reset", error);
    return json({ error: "목표 타임머신을 재설정하지 못했어요." }, 500);
  }
  if (!data) return json({ error: "재설정할 목표 타임머신을 찾지 못했어요." }, 404);

  invalidatePublicDashboardCache();
  after(() => broadcastDashboardRefreshFromServer(service));
  return json({ reset: { goal_id: data.id, participant_id: data.participant_id } });
}
