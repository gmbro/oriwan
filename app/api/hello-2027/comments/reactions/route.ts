import { NextRequest, NextResponse } from "next/server";

import {
  HELLO_2027_COMMENTS_LIVE,
  HELLO_2027_COMMENTS_SEASON,
  applyHello2027VisitorCookie,
  getHello2027CommentsService,
  hello2027PrivateHeaders,
  isHello2027CommentEmoji,
  readHello2027JsonBody,
  readHello2027ReactionSummary,
  resolveHello2027CommentActor,
} from "@/lib/hello-2027-comments-server";
import { guardMutationRequest } from "@/lib/request-security";
import { logServerFailure } from "@/lib/server-error-log";
import { isMissingTableError, missingSchemaResponse } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reactionJson(
  payload: Record<string, unknown>,
  status: number,
  actor?: Awaited<ReturnType<typeof resolveHello2027CommentActor>>,
) {
  const response = NextResponse.json(payload, { status, headers: hello2027PrivateHeaders });
  return actor ? applyHello2027VisitorCookie(response, actor) : response;
}

export async function POST(request: NextRequest) {
  const guardResponse = guardMutationRequest(request, {
    maxBodyBytes: 2 * 1024,
    rateLimit: {
      key: "hello-2027-comment-reaction",
      limit: 30,
      windowMs: 60_000,
      message: "반응 요청이 잠시 몰렸어요. 조금 뒤 다시 눌러주세요.",
    },
  });
  if (guardResponse) return guardResponse;
  if (!HELLO_2027_COMMENTS_LIVE) {
    return reactionJson({ error: "정식 오픈 후 댓글에 반응할 수 있어요." }, 403);
  }

  const parsedBody = await readHello2027JsonBody(request, 2 * 1024);
  if (!parsedBody.ok) return reactionJson({ error: parsedBody.error }, parsedBody.status);
  const payload = parsedBody.value;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return reactionJson({ error: "반응할 댓글과 이모지를 다시 확인해주세요." }, 400);
  }
  const record = payload as Record<string, unknown>;
  const commentId = typeof record.comment_id === "string" ? record.comment_id : "";
  const emoji = record.emoji;
  if (!UUID_PATTERN.test(commentId) || !isHello2027CommentEmoji(emoji)) {
    return reactionJson({ error: "반응할 댓글과 이모지를 다시 확인해주세요." }, 400);
  }

  const actor = await resolveHello2027CommentActor(request);
  if (actor.authError) {
    return reactionJson({ error: "로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, 503);
  }
  const service = getHello2027CommentsService();
  if (!service) return reactionJson({ error: "공용 댓글 저장소가 아직 준비되지 않았어요." }, 503, actor);

  try {
    const { data: comment, error: commentError } = await service
      .from("hello_2027_comments")
      .select("id, parent_id")
      .eq("id", commentId)
      .eq("season_key", HELLO_2027_COMMENTS_SEASON)
      .eq("status", "visible")
      .maybeSingle();
    if (commentError) {
      if (isMissingTableError(commentError)) {
        return reactionJson(missingSchemaResponse("공용 댓글 저장소가 아직 준비되지 않았어요."), 503, actor);
      }
      throw commentError;
    }
    if (!comment) return reactionJson({ error: "반응할 댓글을 찾지 못했어요." }, 404, actor);

    if (comment.parent_id) {
      const { data: parent, error: parentError } = await service
        .from("hello_2027_comments")
        .select("id")
        .eq("id", comment.parent_id)
        .eq("season_key", HELLO_2027_COMMENTS_SEASON)
        .in("status", ["visible", "deleted"])
        .is("parent_id", null)
        .maybeSingle();
      if (parentError) throw parentError;
      if (!parent) return reactionJson({ error: "반응할 댓글을 찾지 못했어요." }, 404, actor);
    }

    const { data: existing, error: existingError } = await service
      .from("hello_2027_comment_reactions")
      .select("id")
      .eq("season_key", HELLO_2027_COMMENTS_SEASON)
      .eq("comment_id", commentId)
      .eq("emoji", emoji)
      .eq("actor_key", actor.actorKey)
      .maybeSingle();
    if (existingError) {
      if (isMissingTableError(existingError)) {
        return reactionJson(missingSchemaResponse("공용 댓글 반응 저장소가 아직 준비되지 않았어요."), 503, actor);
      }
      throw existingError;
    }

    if (existing) {
      const { error } = await service
        .from("hello_2027_comment_reactions")
        .delete()
        .eq("id", existing.id)
        .eq("season_key", HELLO_2027_COMMENTS_SEASON)
        .eq("comment_id", commentId)
        .eq("actor_key", actor.actorKey);
      if (error) throw error;
    } else {
      const { error } = await service
        .from("hello_2027_comment_reactions")
        .insert({
          season_key: HELLO_2027_COMMENTS_SEASON,
          comment_id: commentId,
          emoji,
          actor_key: actor.actorKey,
          auth_user_id: actor.user?.id ?? null,
        });
      if (error && error.code !== "23505") {
        if (error.code === "23514") {
          return reactionJson({ error: "댓글 상태가 변경되어 반응할 수 없어요." }, 409, actor);
        }
        throw error;
      }
    }

    const result = await readHello2027ReactionSummary(service, commentId, actor.actorKey);
    if (result.error) throw result.error;
    return reactionJson({ comment_id: commentId, reactions: result.reactions }, 200, actor);
  } catch (error) {
    logServerFailure("Hello 2027 comment reaction", error);
    return reactionJson({ error: "반응을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, 500, actor);
  }
}
