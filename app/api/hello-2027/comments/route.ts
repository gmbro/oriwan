import { NextRequest, NextResponse } from "next/server";

import {
  HELLO_2027_COMMENTS_LIVE,
  HELLO_2027_COMMENTS_SEASON,
  applyHello2027VisitorCookie,
  createHello2027DeletedActorKey,
  getHello2027CommentsService,
  hello2027PrivateHeaders,
  normalizeCommentBody,
  pickHello2027RandomNickname,
  readHello2027JsonBody,
  readHello2027Threads,
  resolveHello2027CommentActor,
  toHello2027Comment,
} from "@/lib/hello-2027-comments-server";
import { HELLO_2027_COMMENT_MAX_REPLIES } from "@/lib/hello-2027-comments-contract";
import { guardMutationRequest, guardReadRequest } from "@/lib/request-security";
import { logServerFailure } from "@/lib/server-error-log";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function publicJson(
  payload: Record<string, unknown>,
  status = 200,
  actor?: Awaited<ReturnType<typeof resolveHello2027CommentActor>>,
) {
  const response = NextResponse.json(payload, { status, headers: hello2027PrivateHeaders });
  return actor ? applyHello2027VisitorCookie(response, actor) : response;
}

function commentsDisabledResponse() {
  return publicJson({
    error: "정식 오픈 후 댓글을 남길 수 있어요.",
    live: false,
  }, 403);
}

export async function GET(request: NextRequest) {
  const guardResponse = guardReadRequest(request, {
    rateLimit: {
      key: "hello-2027-comments-read",
      limit: 120,
      windowMs: 60_000,
    },
  });
  if (guardResponse) return guardResponse;

  if (!HELLO_2027_COMMENTS_LIVE) {
    return publicJson({ threads: [], live: false, source: "preview" });
  }

  const actor = await resolveHello2027CommentActor(request);
  const service = getHello2027CommentsService();
  if (!service) {
    return publicJson({
      threads: [],
      live: false,
      source: "fallback",
      error: "공용 댓글 저장소가 아직 준비되지 않았어요.",
    });
  }

  try {
    const { threads, error } = await readHello2027Threads(service, actor.actorKey);
    if (error) {
      if (isMissingTableError(error)) {
        return publicJson({
          threads: [],
          live: false,
          source: "fallback",
          ...missingSchemaResponse("공용 댓글 저장소가 아직 준비되지 않았어요."),
        });
      }
      throw error;
    }

    return publicJson({ threads, live: true, source: "supabase" });
  } catch (error) {
    logServerFailure("Hello 2027 comments read", error);
    return publicJson({
      threads: [],
      live: false,
      source: "fallback",
      error: "댓글을 불러오지 못해 미리보기 댓글을 보여드려요.",
    });
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 4 * 1024,
    rateLimit: {
      key: "hello-2027-comment-create",
      limit: 6,
      windowMs: 60_000,
      message: "댓글 등록이 잠시 몰렸어요. 1분 뒤 다시 시도해주세요.",
    },
  });
  if (guardResponse) return guardResponse;
  if (!HELLO_2027_COMMENTS_LIVE) return commentsDisabledResponse();

  const parsedBody = await readHello2027JsonBody(request, 4 * 1024);
  if (!parsedBody.ok) return publicJson({ error: parsedBody.error }, parsedBody.status);
  const payload = parsedBody.value;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return publicJson({ error: "댓글 내용을 다시 확인해주세요." }, 400);
  }

  const record = payload as Record<string, unknown>;
  const body = normalizeCommentBody(record.body);
  const parentId = record.parent_id === undefined || record.parent_id === null || record.parent_id === ""
    ? null
    : typeof record.parent_id === "string" && UUID_PATTERN.test(record.parent_id)
      ? record.parent_id
      : undefined;
  if (!body) return publicJson({ error: "댓글은 공백 없이 150자 이내로 입력해주세요." }, 400);
  if (parentId === undefined) return publicJson({ error: "답글을 남길 댓글을 다시 확인해주세요." }, 400);

  const actor = await resolveHello2027CommentActor(request);
  if (actor.authError) {
    return publicJson({ error: "로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, 503);
  }
  const authorMode = actor.user ? "kakao" : "random";
  if (authorMode === "kakao" && (!actor.user || !actor.kakaoName)) {
    return publicJson({ error: "카카오 이름으로 작성하려면 다시 로그인해주세요." }, 401, actor);
  }

  const service = getHello2027CommentsService();
  if (!service) {
    return publicJson({ error: "공용 댓글 저장소가 아직 준비되지 않았어요." }, 503, actor);
  }

  try {
    if (parentId) {
      const [{ data: parent, error: parentError }, { count, error: countError }] = await Promise.all([
        service
          .from("hello_2027_comments")
          .select("id")
          .eq("id", parentId)
          .eq("season_key", HELLO_2027_COMMENTS_SEASON)
          .eq("status", "visible")
          .is("parent_id", null)
          .maybeSingle(),
        service
          .from("hello_2027_comments")
          .select("id", { count: "exact", head: true })
          .eq("season_key", HELLO_2027_COMMENTS_SEASON)
          .eq("parent_id", parentId)
          .eq("status", "visible"),
      ]);
      if (parentError || countError) {
        const storageError = parentError || countError;
        if (isMissingTableError(storageError)) {
          return publicJson(missingSchemaResponse("공용 댓글 저장소가 아직 준비되지 않았어요."), 503, actor);
        }
        throw storageError;
      }
      if (!parent) return publicJson({ error: "답글을 남길 댓글을 찾지 못했어요." }, 404, actor);
      if ((count || 0) >= HELLO_2027_COMMENT_MAX_REPLIES) {
        return publicJson({ error: "이 댓글에는 답글이 충분히 모였어요. 새 댓글로 이어주세요." }, 409, actor);
      }
    }

    const { data, error } = await service
      .from("hello_2027_comments")
      .insert({
        season_key: HELLO_2027_COMMENTS_SEASON,
        parent_id: parentId,
        author_name: authorMode === "kakao" ? actor.kakaoName : pickHello2027RandomNickname(),
        author_mode: authorMode,
        auth_user_id: actor.user?.id || null,
        actor_key: actor.actorKey,
        body,
        status: "visible",
      })
      .select("id, parent_id, author_name, body, created_at")
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return publicJson(missingSchemaResponse("공용 댓글 저장소가 아직 준비되지 않았어요."), 503, actor);
      }
      if (error.code === "23514") {
        return publicJson({ error: "답글을 더 남길 수 없거나 원문 상태가 변경됐어요." }, 409, actor);
      }
      throw error;
    }

    return publicJson({ comment: toHello2027Comment(data) }, 201, actor);
  } catch (error) {
    logServerFailure("Hello 2027 comment create", error);
    return publicJson({ error: "댓글을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, 500, actor);
  }
}

export async function DELETE(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 2 * 1024,
    rateLimit: {
      key: "hello-2027-comment-delete",
      limit: 10,
      windowMs: 60_000,
    },
  });
  if (guardResponse) return guardResponse;
  if (!HELLO_2027_COMMENTS_LIVE) return commentsDisabledResponse();

  const parsedBody = await readHello2027JsonBody(request, 2 * 1024);
  if (!parsedBody.ok) return publicJson({ error: parsedBody.error }, parsedBody.status);
  const payload = parsedBody.value;
  const id = payload && typeof payload === "object" && !Array.isArray(payload)
    && typeof (payload as Record<string, unknown>).id === "string"
    ? (payload as Record<string, string>).id
    : "";
  if (!UUID_PATTERN.test(id)) return publicJson({ error: "삭제할 댓글을 다시 확인해주세요." }, 400);

  const actor = await resolveHello2027CommentActor(request);
  if (actor.authError) {
    return publicJson({ error: "로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, 503);
  }
  const service = getHello2027CommentsService();
  if (!service) return publicJson({ error: "공용 댓글 저장소가 아직 준비되지 않았어요." }, 503, actor);

  try {
    const { data, error } = await service.rpc("delete_hello_2027_comment", {
      p_comment_id: id,
      p_season_key: HELLO_2027_COMMENTS_SEASON,
      p_deleted_actor_key: createHello2027DeletedActorKey(),
      p_expected_actor_key: actor.actorKey,
      p_moderated_by: null,
    });
    if (error) {
      if (isMissingTableError(error)) {
        return publicJson(missingSchemaResponse("공용 댓글 삭제 기능이 아직 준비되지 않았어요."), 503, actor);
      }
      throw error;
    }
    if (data !== "deleted") {
      return publicJson({ error: "삭제할 수 있는 댓글을 찾지 못했어요." }, 404, actor);
    }
    return publicJson({ ok: true, id, status: "deleted" }, 200, actor);
  } catch (error) {
    logServerFailure("Hello 2027 comment delete", error);
    return publicJson({ error: "댓글을 삭제하지 못했어요. 잠시 후 다시 시도해주세요." }, 500, actor);
  }
}
