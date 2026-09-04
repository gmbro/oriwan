import { NextRequest, NextResponse } from "next/server";

import { requireAdminDataAccess } from "@/lib/admin-data-access";
import {
  HELLO_2027_COMMENTS_SEASON,
  createHello2027DeletedActorKey,
  readHello2027JsonBody,
  readHello2027ReactionRows,
  type CommentRow,
} from "@/lib/hello-2027-comments-server";
import { HELLO_2027_COMMENT_LIST_LIMIT } from "@/lib/hello-2027-comments-contract";
import { guardMutationRequest, guardReadRequest } from "@/lib/request-security";
import { logServerFailure } from "@/lib/server-error-log";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const adminHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

function adminJson(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: adminHeaders });
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    requireSameOrigin: true,
    rateLimit: { key: "admin-hello-2027-comments-read", limit: 60, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { service } = access;

  try {
    const { data, error } = await service
      .from("hello_2027_comments")
      .select("id, parent_id, author_name, author_mode, body, status, created_at, updated_at, deleted_at")
      .eq("season_key", HELLO_2027_COMMENTS_SEASON)
      .order("created_at", { ascending: false })
      .limit(HELLO_2027_COMMENT_LIST_LIMIT);
    if (error) {
      if (isMissingTableError(error)) {
        return adminJson(missingSchemaResponse("댓글 관리 저장소가 아직 준비되지 않았어요."), 503);
      }
      throw error;
    }

    const rows = (data || []) as CommentRow[];
    const commentIds = rows.map((row) => row.id);
    const { rows: reactions, error: reactionError } = await readHello2027ReactionRows(service, commentIds);
    if (reactionError) {
      if (isMissingTableError(reactionError)) {
        return adminJson(missingSchemaResponse("댓글 반응 저장소가 아직 준비되지 않았어요."), 503);
      }
      throw reactionError;
    }

    const reactionCounts = new Map<string, number>();
    for (const reaction of reactions) {
      reactionCounts.set(reaction.comment_id, (reactionCounts.get(reaction.comment_id) || 0) + 1);
    }
    const replyCounts = new Map<string, number>();
    for (const row of rows) {
      if (row.parent_id && row.status !== "deleted") {
        replyCounts.set(row.parent_id, (replyCounts.get(row.parent_id) || 0) + 1);
      }
    }

    return adminJson({
      comments: rows.map((row) => ({
        id: row.id,
        parent_id: row.parent_id,
        author_name: row.author_name,
        author_mode: row.author_mode,
        body: row.body,
        created_at: row.created_at,
        status: row.status,
        deleted_at: row.deleted_at || null,
        reactions_count: reactionCounts.get(row.id) || 0,
        replies_count: replyCounts.get(row.id) || 0,
      })),
    });
  } catch (error) {
    logServerFailure("Admin Hello 2027 comments read", error);
    return adminJson({ error: "댓글 목록을 불러오지 못했어요." }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 2 * 1024,
    rateLimit: { key: "admin-hello-2027-comment-status", limit: 30, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user: adminUser, service } = access;

  const parsedBody = await readHello2027JsonBody(request, 2 * 1024);
  if (!parsedBody.ok) return adminJson({ error: parsedBody.error }, parsedBody.status);
  const payload = parsedBody.value;
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
  const id = typeof record?.id === "string" ? record.id : "";
  const status = record?.status === "visible" || record?.status === "hidden" ? record.status : null;
  if (!UUID_PATTERN.test(id) || !status) {
    return adminJson({ error: "변경할 댓글과 공개 상태를 다시 확인해주세요." }, 400);
  }

  try {
    const { data: existing, error: existingError } = await service
      .from("hello_2027_comments")
      .select("id, status")
      .eq("id", id)
      .eq("season_key", HELLO_2027_COMMENTS_SEASON)
      .maybeSingle();
    if (existingError) {
      if (isMissingTableError(existingError)) {
        return adminJson(missingSchemaResponse("댓글 관리 저장소가 아직 준비되지 않았어요."), 503);
      }
      throw existingError;
    }
    if (!existing) return adminJson({ error: "댓글을 찾지 못했어요." }, 404);
    if (existing.status === "deleted") {
      return adminJson({ error: "삭제된 댓글은 공개 상태로 되돌릴 수 없어요." }, 409);
    }

    const updatedAt = new Date().toISOString();
    const { data, error } = await service
      .from("hello_2027_comments")
      .update({ status, moderated_by: adminUser.id, updated_at: updatedAt })
      .eq("id", id)
      .eq("season_key", HELLO_2027_COMMENTS_SEASON)
      .neq("status", "deleted")
      .select("id, parent_id, author_name, author_mode, body, status, created_at, updated_at, deleted_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return adminJson({ error: "삭제된 댓글은 공개 상태로 되돌릴 수 없어요." }, 409);
    }
    return adminJson({ comment: data });
  } catch (error) {
    logServerFailure("Admin Hello 2027 comment status", error);
    return adminJson({ error: "댓글 공개 상태를 변경하지 못했어요." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 2 * 1024,
    rateLimit: { key: "admin-hello-2027-comment-delete", limit: 20, windowMs: 60_000 },
  });
  if (guardResponse) return guardResponse;

  const access = await requireAdminDataAccess();
  if (!access.ok) return access.response;
  const { user: adminUser, service } = access;

  const parsedBody = await readHello2027JsonBody(request, 2 * 1024);
  if (!parsedBody.ok) return adminJson({ error: parsedBody.error }, parsedBody.status);
  const payload = parsedBody.value;
  const id = payload && typeof payload === "object" && !Array.isArray(payload)
    && typeof (payload as Record<string, unknown>).id === "string"
    ? (payload as Record<string, string>).id
    : "";
  if (!UUID_PATTERN.test(id)) return adminJson({ error: "삭제할 댓글을 다시 확인해주세요." }, 400);

  try {
    const { data, error } = await service.rpc("delete_hello_2027_comment", {
      p_comment_id: id,
      p_season_key: HELLO_2027_COMMENTS_SEASON,
      p_deleted_actor_key: createHello2027DeletedActorKey(),
      p_expected_actor_key: null,
      p_moderated_by: adminUser.id,
    });
    if (error) {
      if (isMissingTableError(error)) {
        return adminJson(missingSchemaResponse("댓글 관리 삭제 기능이 아직 준비되지 않았어요."), 503);
      }
      throw error;
    }
    if (data !== "deleted") return adminJson({ error: "삭제할 댓글을 찾지 못했어요." }, 404);
    return adminJson({ ok: true, id, status: "deleted" });
  } catch (error) {
    logServerFailure("Admin Hello 2027 comment delete", error);
    return adminJson({ error: "댓글을 삭제하지 못했어요." }, 500);
  }
}
