import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import type {
  Hello2027GuestbookReply,
  Hello2027GuestbookThread,
  Hello2027Reaction,
} from "@/lib/hello-2027-types";
import { getServiceClient } from "@/lib/admin-data";
import {
  HELLO_2027_COMMENT_AUTHOR_MAX_LENGTH,
  HELLO_2027_COMMENT_BODY_MAX_LENGTH,
  HELLO_2027_COMMENT_EMOJIS,
  HELLO_2027_COMMENT_MAX_REPLIES,
  HELLO_2027_COMMENT_PUBLIC_THREAD_LIMIT,
  type Hello2027CommentAuthorMode,
  type Hello2027CommentEmoji,
} from "@/lib/hello-2027-comments-contract";
import { getKakaoDisplayName } from "@/lib/kakao-display-name";
import { FOURTH_SEASON_KEY, resolveParticipantAccount } from "@/lib/participant-account-server";
import { logServerFailure } from "@/lib/server-error-log";
import { createClient } from "@/lib/supabase/server";

const VISITOR_COOKIE = "twtt_hello_2027_visitor";
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const VISITOR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const RANDOM_NICKNAMES = [
  "새벽다람쥐", "포근한구름", "아침참새", "파란물결", "느긋한수달", "달빛토끼",
  "산책고양이", "초록바람", "작은반달", "강변여우", "졸린판다", "햇살두더지",
  "말랑한별", "노을오리", "러닝펭귄", "민들레씨", "고요한사슴", "새벽반딧불",
  "단풍고슴도치", "구름너구리", "아침해달", "푸른솔방울", "따뜻한보폭", "느린유성",
] as const;

type CommentRow = {
  id: string;
  parent_id: string | null;
  author_name: string;
  author_mode?: Hello2027CommentAuthorMode;
  auth_user_id?: string | null;
  actor_key?: string;
  body: string;
  status?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
};

type ReactionRow = {
  comment_id: string;
  emoji: Hello2027CommentEmoji;
  actor_key: string;
};

export type Hello2027CommentActor = {
  actorKey: string;
  user: User | null;
  kakaoName: string | null;
  visitorToken: string | null;
  setVisitorCookie: boolean;
  authError: boolean;
};

export const HELLO_2027_COMMENTS_LIVE = process.env.HELLO_2027_COMMENTS_LIVE === "true";
export const HELLO_2027_COMMENTS_SEASON = FOURTH_SEASON_KEY;
export const hello2027PrivateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

function isKakaoUser(user: User | null) {
  if (!user) return false;
  return user.app_metadata?.provider === "kakao"
    || Boolean(user.identities?.some((identity) => identity.provider === "kakao"));
}

function visitorActorKey(token: string) {
  return `guest:${createHash("sha256").update(token).digest("hex")}`;
}

function userActorKey(userId: string) {
  return `user:${createHash("sha256").update(userId).digest("hex")}`;
}

export async function resolveHello2027CommentActor(request: NextRequest): Promise<Hello2027CommentActor> {
  let user: User | null = null;
  let authError = false;
  const hasAuthCookie = request.cookies.getAll().some(({ name }) =>
    name.startsWith("sb-") && name.includes("auth-token"));
  const hasAuthConfiguration = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (hasAuthConfiguration) {
    try {
      const auth = await createClient();
      const result = await auth.auth.getUser();
      if (result.error && hasAuthCookie) authError = true;
      user = isKakaoUser(result.data.user) ? result.data.user : null;
    } catch (error) {
      logServerFailure("Hello 2027 comment auth lookup", error);
      if (hasAuthCookie) authError = true;
    }
  } else if (hasAuthCookie) {
    authError = true;
  }

  if (authError) {
    return {
      actorKey: "auth-error",
      user: null,
      kakaoName: null,
      visitorToken: null,
      setVisitorCookie: false,
      authError: true,
    };
  }

  if (user) {
    let kakaoName = getKakaoDisplayName(user);
    const service = getServiceClient();
    if (service) {
      try {
        const connection = await resolveParticipantAccount(service, user.id);
        if (connection.status === "approved" && connection.displayName) {
          kakaoName = connection.displayName;
        }
      } catch (error) {
        // A profile connection outage must not turn an otherwise valid Kakao
        // session into an anonymous author. Fall back to Kakao identity data.
        logServerFailure("Hello 2027 comment display-name lookup", error);
      }
    }

    return {
      actorKey: userActorKey(user.id),
      user,
      kakaoName: normalizeAuthorName(kakaoName),
      visitorToken: null,
      setVisitorCookie: false,
      authError: false,
    };
  }

  const existingToken = request.cookies.get(VISITOR_COOKIE)?.value || "";
  const hasValidToken = VISITOR_TOKEN_PATTERN.test(existingToken);
  const visitorToken = hasValidToken ? existingToken : randomBytes(32).toString("base64url");
  return {
    actorKey: visitorActorKey(visitorToken),
    user: null,
    kakaoName: null,
    visitorToken,
    setVisitorCookie: !hasValidToken,
    authError: false,
  };
}

export function applyHello2027VisitorCookie(response: NextResponse, actor: Hello2027CommentActor) {
  if (!actor.setVisitorCookie || !actor.visitorToken) return response;
  response.cookies.set(VISITOR_COOKIE, actor.visitorToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

export function normalizeCommentBody(value: unknown) {
  if (typeof value !== "string") return null;
  const body = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "")
    .trim();
  if (!body || body.length > HELLO_2027_COMMENT_BODY_MAX_LENGTH) return null;
  return body;
}

export async function readHello2027JsonBody(request: NextRequest, maxBytes: number) {
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
      return {
        ok: false as const,
        status: 413,
        error: "요청 용량이 너무 커요. 내용을 줄여 다시 시도해주세요.",
      };
    }
    return { ok: true as const, value: JSON.parse(rawBody) as unknown };
  } catch {
    return {
      ok: false as const,
      status: 400,
      error: "요청 형식을 확인할 수 없어요. 페이지를 새로고침한 뒤 다시 시도해주세요.",
    };
  }
}

export function normalizeAuthorName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2 || name.length > HELLO_2027_COMMENT_AUTHOR_MAX_LENGTH) return null;
  return name;
}

export function parseCommentAuthorMode(value: unknown): Hello2027CommentAuthorMode | null {
  return value === "random" || value === "kakao" ? value : null;
}

export function isHello2027CommentEmoji(value: unknown): value is Hello2027CommentEmoji {
  return typeof value === "string"
    && (HELLO_2027_COMMENT_EMOJIS as readonly string[]).includes(value);
}

export function pickHello2027RandomNickname() {
  return RANDOM_NICKNAMES[randomInt(RANDOM_NICKNAMES.length)];
}

export function createHello2027DeletedActorKey() {
  return `deleted:${randomBytes(24).toString("base64url")}`;
}

export function getHello2027CommentsService() {
  return getServiceClient();
}

function aggregateReactions(rows: readonly ReactionRow[], actorKey: string) {
  const countByEmoji = new Map<Hello2027CommentEmoji, number>();
  const reacted = new Set<Hello2027CommentEmoji>();
  for (const row of rows) {
    if (!isHello2027CommentEmoji(row.emoji)) continue;
    countByEmoji.set(row.emoji, Math.min(9_999, (countByEmoji.get(row.emoji) || 0) + 1));
    if (row.actor_key === actorKey) reacted.add(row.emoji);
  }
  return HELLO_2027_COMMENT_EMOJIS.flatMap((emoji) => {
    const count = countByEmoji.get(emoji) || 0;
    return count > 0 ? [{ emoji, count, reacted: reacted.has(emoji) }] : [];
  }) as Hello2027Reaction[];
}

const REACTION_PAGE_SIZE = 1_000;
const REACTION_MAX_ROWS = 50_000;

export async function readHello2027ReactionRows(
  service: SupabaseClient,
  commentIds: readonly string[],
) {
  const rows: ReactionRow[] = [];
  if (commentIds.length === 0) return { rows, error: null };

  for (let chunkStart = 0; chunkStart < commentIds.length; chunkStart += 50) {
    const commentIdChunk = commentIds.slice(chunkStart, chunkStart + 50);
    for (let offset = 0; rows.length < REACTION_MAX_ROWS; offset += REACTION_PAGE_SIZE) {
      const { data, error } = await service
        .from("hello_2027_comment_reactions")
        .select("comment_id, emoji, actor_key")
        .eq("season_key", HELLO_2027_COMMENTS_SEASON)
        .in("comment_id", commentIdChunk)
        .order("id", { ascending: true })
        .range(offset, offset + REACTION_PAGE_SIZE - 1);
      if (error) return { rows: [] as ReactionRow[], error };
      const page = (data || []) as ReactionRow[];
      rows.push(...page);
      if (page.length < REACTION_PAGE_SIZE) break;
    }
    if (rows.length >= REACTION_MAX_ROWS) break;
  }

  return { rows, error: null };
}

export async function readHello2027ReactionSummary(
  service: SupabaseClient,
  commentId: string,
  actorKey: string,
) {
  const { rows, error } = await readHello2027ReactionRows(service, [commentId]);
  if (error) return { reactions: [] as Hello2027Reaction[], error };
  return { reactions: aggregateReactions(rows, actorKey), error: null };
}

export async function readHello2027Threads(service: SupabaseClient, actorKey: string) {
  const { data: topLevelComments, error: commentError } = await service
    .from("hello_2027_comments")
    .select("id, parent_id, author_name, body, status, created_at")
    .eq("season_key", HELLO_2027_COMMENTS_SEASON)
    .in("status", ["visible", "deleted"])
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(HELLO_2027_COMMENT_PUBLIC_THREAD_LIMIT);
  if (commentError) return { threads: [] as Hello2027GuestbookThread[], error: commentError };

  const topLevelRows = (topLevelComments || []) as CommentRow[];
  const topLevelIds = topLevelRows.map((row) => row.id);
  const replyRows: CommentRow[] = [];
  const replyLimit = HELLO_2027_COMMENT_PUBLIC_THREAD_LIMIT * HELLO_2027_COMMENT_MAX_REPLIES;
  if (topLevelIds.length > 0) {
    for (let offset = 0; offset < replyLimit; offset += REACTION_PAGE_SIZE) {
      const { data, error } = await service
        .from("hello_2027_comments")
        .select("id, parent_id, author_name, body, status, created_at")
        .eq("season_key", HELLO_2027_COMMENTS_SEASON)
        .eq("status", "visible")
        .in("parent_id", topLevelIds)
        .order("created_at", { ascending: true })
        .range(offset, offset + REACTION_PAGE_SIZE - 1);
      if (error) return { threads: [] as Hello2027GuestbookThread[], error };
      const page = (data || []) as CommentRow[];
      replyRows.push(...page);
      if (page.length < REACTION_PAGE_SIZE) break;
    }
  }

  const rows = [...topLevelRows, ...replyRows];
  const commentIds = rows.map((row) => row.id);
  const { rows: reactions, error: reactionError } = await readHello2027ReactionRows(service, commentIds);
  if (reactionError) return { threads: [] as Hello2027GuestbookThread[], error: reactionError };

  const reactionsByComment = new Map<string, ReactionRow[]>();
  for (const reaction of reactions) {
    const current = reactionsByComment.get(reaction.comment_id) || [];
    current.push(reaction);
    reactionsByComment.set(reaction.comment_id, current);
  }

  const repliesByParent = new Map<string, Hello2027GuestbookReply[]>();
  for (const row of replyRows) {
    if (!row.parent_id) continue;
    const replies = repliesByParent.get(row.parent_id) || [];
    replies.push({
      id: row.id,
      author: row.author_name,
      body: row.body,
      createdAt: row.created_at,
      reactions: aggregateReactions(reactionsByComment.get(row.id) || [], actorKey),
    });
    repliesByParent.set(row.parent_id, replies);
  }

  const threads = topLevelRows
    .filter((row) => row.status === "visible" || (repliesByParent.get(row.id)?.length || 0) > 0)
    .map((row) => ({
      id: row.id,
      author: row.author_name,
      body: row.body,
      createdAt: row.created_at,
      reactions: aggregateReactions(reactionsByComment.get(row.id) || [], actorKey),
      replies: repliesByParent.get(row.id) || [],
    } satisfies Hello2027GuestbookThread));

  return { threads, error: null };
}

export function toHello2027Comment(
  row: CommentRow,
  reactions: readonly Hello2027Reaction[] = [],
): Hello2027GuestbookThread | Hello2027GuestbookReply {
  const base = {
    id: row.id,
    author: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    reactions,
  };
  return row.parent_id ? base : { ...base, replies: [] };
}

export type { CommentRow, ReactionRow };
