import { NextRequest, NextResponse, after } from "next/server";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { guardMutationRequest, guardReadRequest, readLimitedJson } from "@/lib/request-security";
import { parseTimeMachineGoalInput, TIME_MACHINE_SEASON_KEY } from "@/lib/time-machine-contract";
import { broadcastDashboardRefreshFromServer } from "@/lib/dashboard-refresh-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function handle(request: NextRequest, method: "GET" | "PATCH" | "DELETE") {
  const guard = method === "GET"
    ? guardReadRequest(request, { requireSameOrigin: true, rateLimit: { key: "admin-goals-read", limit: 120, windowMs: 60_000 } })
    : guardMutationRequest(request, { maxBodyBytes: 4096, rateLimit: { key: "admin-goals-write", limit: 30, windowMs: 60_000 } });
  if (guard) return guard;
  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  let body: Record<string, unknown> = {};
  if (method !== "GET") {
    const parsed = await readLimitedJson(request, 4096);
    if (!parsed.ok) return parsed.response;
    body = parsed.value;
  }
  const participantId = method === "GET" ? request.nextUrl.searchParams.get("participant_id") : body.participant_id;
  if (typeof participantId !== "string" || !uuid.test(participantId)) return json({ error: "멤버를 선택해주세요." }, 400);
  const { service, user } = access;
  try {
    // Scope every read and write to this operator's season and participant.
    const scoped = () => service.from("time_machine_goals");
    if (method === "GET") {
      const { data, error } = await scoped().select("id, goal_title, goal_detail, commitment, created_at").eq("user_id", user.id).eq("season_key", TIME_MACHINE_SEASON_KEY).eq("participant_id", participantId).maybeSingle();
      if (error) throw error;
      return json({ goal: data });
    }
    let query;
    if (method === "PATCH") {
      const parsed = parseTimeMachineGoalInput(body);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      // Administrative correction does not restart the member's 30-day lock.
      query = scoped().update(parsed.value);
    } else query = scoped().delete();
    const { data, error } = await query.eq("user_id", user.id).eq("season_key", TIME_MACHINE_SEASON_KEY).eq("participant_id", participantId).select("id, goal_title, goal_detail, commitment, created_at").maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "목표가 없거나 관리 권한이 없어요." }, 404);
    after(() => broadcastDashboardRefreshFromServer(service));
    return json({ goal: method === "DELETE" ? null : data });
  } catch {
    return json({ error: "목표를 처리하지 못했어요. 다시 시도해주세요." }, 500);
  }
}
export const GET = (request: NextRequest) => handle(request, "GET");
export const PATCH = (request: NextRequest) => handle(request, "PATCH");
export const DELETE = (request: NextRequest) => handle(request, "DELETE");
