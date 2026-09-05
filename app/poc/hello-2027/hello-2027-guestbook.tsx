"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { HELLO_2027_COMMENT_BODY_MAX_LENGTH } from "@/lib/hello-2027-comments-contract";
import type {
  Hello2027GuestbookThread,
  Hello2027Reaction,
} from "@/lib/hello-2027-types";
import styles from "./hello-2027-poc.module.css";

type Hello2027GuestbookProps = {
  initialThreads: readonly Hello2027GuestbookThread[];
  externalViewer?: Hello2027Viewer | null;
  externalViewerManaged?: boolean;
  externalViewerLoading?: boolean;
};

type Hello2027Viewer = {
  authenticated: boolean;
  provider: "kakao" | null;
  display_name: string | null;
  approved_participant: boolean;
  verified_name?: boolean;
  name_source?: "admin" | "kakao" | null;
  connection_status?: string;
};

type CommentsReadResponse = {
  threads?: Hello2027GuestbookThread[];
  live?: boolean;
  source?: "preview" | "fallback" | "supabase";
  error?: string;
};

type CommentMutationResponse = {
  comment?: Hello2027GuestbookThread | Hello2027GuestbookThread["replies"][number];
  error?: string;
};

type ReactionMutationResponse = {
  comment_id?: string;
  reactions?: Hello2027Reaction[];
  error?: string;
};

const MAX_GUESTBOOK_BODY_LENGTH = HELLO_2027_COMMENT_BODY_MAX_LENGTH;

const REACTION_OPTIONS: readonly Hello2027Reaction["emoji"][] = ["👍", "❤️", "👏", "🌱", "🏃"];
const REACTION_NAMES: Record<Hello2027Reaction["emoji"], string> = {
  "👍": "좋아요",
  "❤️": "마음",
  "👏": "박수",
  "🌱": "응원",
  "🏃": "함께 달려요",
};

function cloneThreads(threads: readonly Hello2027GuestbookThread[]): Hello2027GuestbookThread[] {
  return threads.map((thread) => ({
    ...thread,
    reactions: (thread.reactions ?? []).map((reaction) => ({ ...reaction })),
    replies: thread.replies.map((reply) => ({
      ...reply,
      reactions: (reply.reactions ?? []).map((reaction) => ({ ...reaction })),
    })),
  }));
}

function formatKoreanDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({})) as Promise<T>;
}

export function Hello2027Guestbook({
  initialThreads,
  externalViewer,
  externalViewerManaged = false,
  externalViewerLoading = false,
}: Hello2027GuestbookProps) {
  const [threads, setThreads] = useState<Hello2027GuestbookThread[]>(() => cloneThreads(initialThreads));
  const [draft, setDraft] = useState("");
  const [localViewer, setLocalViewer] = useState<Hello2027Viewer | null>(null);
  const viewer = externalViewerManaged ? externalViewer ?? null : localViewer;
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(() => new Set());
  const [validationMessage, setValidationMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const [commentsLive, setCommentsLive] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [localViewerLoading, setLocalViewerLoading] = useState(!externalViewerManaged);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const replyTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const commentsLocked = !commentsLive;
  const viewerLoading = externalViewerManaged ? externalViewerLoading : localViewerLoading;

  useEffect(() => {
    let active = true;
    if (!externalViewerManaged) {
      void fetch("/api/hello-2027/viewer", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<Hello2027Viewer>;
        })
        .then((nextViewer) => {
          if (active && nextViewer) setLocalViewer(nextViewer);
        })
        .catch(() => {
          if (active) setLocalViewer({
            authenticated: false,
            provider: null,
            display_name: null,
            approved_participant: false,
          });
        })
        .finally(() => {
          if (active) setLocalViewerLoading(false);
        });
    }
    void fetch("/api/hello-2027/comments", { cache: "no-store" })
      .then(async (response) => {
        const payload = await readJson<CommentsReadResponse>(response);
        if (!active) return;
        if (response.ok && payload.live && Array.isArray(payload.threads)) {
          setThreads(cloneThreads(payload.threads));
          setCommentsLive(true);
        } else {
          setThreads([]);
          setCommentsLive(false);
        }
      })
      .catch(() => {
        if (active) {
          setThreads([]);
          setCommentsLive(false);
        }
      })
      .finally(() => {
        if (active) setCommentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [externalViewerManaged, initialThreads]);

  const submitThread = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (commentsLocked) {
      setValidationMessage("정식 오픈 후 댓글을 남길 수 있어요.");
      return;
    }
    if (viewer?.authenticated && !viewer.display_name) {
      setValidationMessage("카카오 이름을 확인하지 못했어요. 다시 로그인하거나 운영자에게 문의해주세요.");
      return;
    }
    const body = draft.trim();
    if (!body) {
      setValidationMessage("남기고 싶은 내용을 입력해주세요.");
      return;
    }
    if (body.length > MAX_GUESTBOOK_BODY_LENGTH) {
      setValidationMessage(`${MAX_GUESTBOOK_BODY_LENGTH}자 이내로 입력해주세요.`);
      return;
    }

    setPendingAction("thread:create");
    try {
      const response = await fetch("/api/hello-2027/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = await readJson<CommentMutationResponse>(response);
      if (!response.ok || !payload.comment || !("replies" in payload.comment)) {
        throw new Error(payload.error || "댓글을 저장하지 못했어요.");
      }
      setThreads((current) => [payload.comment as Hello2027GuestbookThread, ...current]);
      setDraft("");
      setValidationMessage("");
      setAnnouncement(viewer?.authenticated
        ? `${viewer.display_name} 이름으로 이야기를 남겼어요.`
        : "랜덤 닉네임으로 이야기를 남겼어요.");
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : "댓글을 저장하지 못했어요.");
    } finally {
      setPendingAction(null);
    }
  };

  const openReplyForm = (threadId: string) => {
    setReplyTargetId(threadId);
    setExpandedThreadIds((current) => new Set(current).add(threadId));
    window.requestAnimationFrame(() => document.getElementById(`reply-body-${threadId}`)?.focus());
  };

  const closeReplyForm = (threadId: string) => {
    setReplyTargetId(null);
    window.requestAnimationFrame(() => replyTriggerRefs.current[threadId]?.focus());
  };

  const submitReply = async (event: FormEvent<HTMLFormElement>, threadId: string) => {
    event.preventDefault();
    if (commentsLocked) {
      setAnnouncement("정식 오픈 후 답글을 남길 수 있어요.");
      return;
    }
    if (viewer?.authenticated && !viewer.display_name) {
      setAnnouncement("카카오 이름을 확인하지 못했어요. 다시 로그인하거나 운영자에게 문의해주세요.");
      return;
    }
    const body = (replyDrafts[threadId] ?? "").trim();
    if (!body) {
      setAnnouncement("답글 내용을 입력해주세요.");
      return;
    }
    if (body.length > MAX_GUESTBOOK_BODY_LENGTH) {
      setAnnouncement(`${MAX_GUESTBOOK_BODY_LENGTH}자 이내로 입력해주세요.`);
      return;
    }

    setPendingAction(`reply:${threadId}`);
    try {
      const response = await fetch("/api/hello-2027/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          parent_id: threadId,
        }),
      });
      const payload = await readJson<CommentMutationResponse>(response);
      if (!response.ok || !payload.comment || "replies" in payload.comment) {
        throw new Error(payload.error || "답글을 저장하지 못했어요.");
      }
      setThreads((current) => current.map((thread) => thread.id === threadId
        ? { ...thread, replies: [...thread.replies, payload.comment!] }
        : thread));
      setReplyDrafts((current) => ({ ...current, [threadId]: "" }));
      setExpandedThreadIds((current) => new Set(current).add(threadId));
      setReplyTargetId(null);
      setAnnouncement(viewer?.authenticated
        ? `${viewer.display_name} 이름으로 답글을 남겼어요.`
        : "랜덤 닉네임으로 답글을 남겼어요.");
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : "답글을 저장하지 못했어요.");
    } finally {
      setPendingAction(null);
    }
  };

  const reactToComment = async (commentId: string, emoji: Hello2027Reaction["emoji"]) => {
    if (commentsLocked) return;
    setPendingAction(`reaction:${commentId}`);
    setReactionPickerId(null);
    try {
      const response = await fetch("/api/hello-2027/comments/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_id: commentId, emoji }),
      });
      const payload = await readJson<ReactionMutationResponse>(response);
      if (!response.ok || !Array.isArray(payload.reactions)) {
        throw new Error(payload.error || "반응을 저장하지 못했어요.");
      }
      setThreads((current) => current.map((thread) => {
        if (thread.id === commentId) return { ...thread, reactions: payload.reactions! };
        return {
          ...thread,
          replies: thread.replies.map((reply) => reply.id === commentId
            ? { ...reply, reactions: payload.reactions! }
            : reply),
        };
      }));
      setAnnouncement(`${REACTION_NAMES[emoji]} 반응을 업데이트했어요.`);
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : "반응을 저장하지 못했어요.");
    } finally {
      setPendingAction(null);
    }
  };

  const reactToThread = (threadId: string, emoji: Hello2027Reaction["emoji"]) => {
    void reactToComment(threadId, emoji);
  };

  const reactToReply = (
    replyId: string,
    emoji: Hello2027Reaction["emoji"],
  ) => {
    void reactToComment(replyId, emoji);
  };

  return (
    <section id="guestbook" className={styles.guestbookSection} aria-labelledby="guestbook-title">
      <div className={styles.guestbookHeading}>
        <h2 id="guestbook-title">댓글</h2>
        <p>문의사항이나 하고 싶은 이야기 떠들어재끼기</p>
      </div>

      {commentsLoading ? (
        <p className={styles.guestbookAnnouncement} role="status">
          공용 댓글을 확인하고 있어요.
        </p>
      ) : null}

      <form className={styles.guestbookComposer} onSubmit={submitThread} aria-describedby="guestbook-help guestbook-error">
        <CommentIdentity viewer={viewer} />
        <label className={styles.bodyLabel} htmlFor="guestbook-body">하고 싶은 이야기</label>
        <textarea
          id="guestbook-body"
          value={draft}
          maxLength={MAX_GUESTBOOK_BODY_LENGTH}
          required
          disabled={commentsLocked || viewerLoading || Boolean(pendingAction)}
          placeholder={commentsLocked ? "정식 오픈 후 댓글을 남길 수 있어요." : "오늘의 느낌이나 궁금한 점을 적어주세요."}
          onChange={(event) => {
            setDraft(event.target.value);
            if (validationMessage) setValidationMessage("");
          }}
        />
        <div className={styles.composerFooter}>
          <div>
            <p id="guestbook-help">{commentsLocked ? "현재 입력 기능은 잠겨 있어요." : viewerLoading ? "로그인 상태를 확인하고 있어요." : "카카오 로그인 시 카카오 프로필 이름 또는 운영자 확인 이름, 미로그인 시 서버가 만든 랜덤 익명 닉네임으로 표시됩니다."}</p>
            <p id="guestbook-error" className={styles.formError}>{validationMessage}</p>
          </div>
          <span>{draft.length}/{MAX_GUESTBOOK_BODY_LENGTH}</span>
          <button type="submit" disabled={commentsLocked || viewerLoading || Boolean(pendingAction) || Boolean(viewer?.authenticated && !viewer.display_name)}>
            {commentsLocked ? "오픈 준비 중" : viewerLoading ? "확인 중" : pendingAction === "thread:create" ? "남기는 중" : viewer?.authenticated ? viewer.verified_name ? "확인 이름으로 남기기" : "카카오 이름으로 남기기" : "익명으로 남기기"}
          </button>
        </div>
      </form>

      <p className={styles.guestbookAnnouncement} role="status" aria-live="polite">{announcement}</p>

      <ol className={styles.threadList}>
        {threads.map((thread) => {
          const expanded = expandedThreadIds.has(thread.id);
          return (
            <li key={thread.id}>
              <article className={styles.threadCard}>
                <div className={styles.commentMeta}>
                  <strong>{thread.author}</strong>
                  <time dateTime={thread.createdAt}>{formatKoreanDateTime(thread.createdAt)}</time>
                </div>
                <p className={styles.threadBody}>{thread.body}</p>
                <ReactionBar
                  reactions={thread.reactions}
                  pickerOpen={reactionPickerId === `thread:${thread.id}`}
                  disabled={commentsLocked || Boolean(pendingAction)}
                  onTogglePicker={() => setReactionPickerId((current) => current === `thread:${thread.id}` ? null : `thread:${thread.id}`)}
                  onReact={(emoji) => reactToThread(thread.id, emoji)}
                />

                <div className={styles.threadActions}>
                  <button
                    ref={(node) => { replyTriggerRefs.current[thread.id] = node; }}
                    type="button"
                    disabled={commentsLocked || viewerLoading || Boolean(pendingAction)}
                    onClick={() => openReplyForm(thread.id)}
                  >
                    답글 달기
                  </button>
                  {thread.replies.length > 0 ? (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`replies-${thread.id}`}
                      onClick={() => setExpandedThreadIds((current) => {
                        const next = new Set(current);
                        if (next.has(thread.id)) next.delete(thread.id);
                        else next.add(thread.id);
                        return next;
                      })}
                    >
                      {expanded ? "답글 접기" : `답글 ${thread.replies.length}개 보기`}
                    </button>
                  ) : null}
                </div>

                {replyTargetId === thread.id ? (
                  <form className={styles.replyComposer} onSubmit={(event) => submitReply(event, thread.id)}>
                    <CommentIdentity viewer={viewer} compact />
                    <label className={styles.bodyLabel} htmlFor={`reply-body-${thread.id}`}>답글</label>
                    <textarea
                      id={`reply-body-${thread.id}`}
                      value={replyDrafts[thread.id] ?? ""}
                      maxLength={MAX_GUESTBOOK_BODY_LENGTH}
                      required
                      disabled={viewerLoading || Boolean(pendingAction)}
                      placeholder="답글을 입력해주세요."
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))}
                    />
                    <div className={styles.replyFooter}>
                      <span>{(replyDrafts[thread.id] ?? "").length}/{MAX_GUESTBOOK_BODY_LENGTH}</span>
                      <button type="button" disabled={Boolean(pendingAction)} onClick={() => closeReplyForm(thread.id)}>취소</button>
                      <button type="submit" disabled={viewerLoading || Boolean(pendingAction) || Boolean(viewer?.authenticated && !viewer.display_name)}>
                        {pendingAction === `reply:${thread.id}` ? "남기는 중" : "답글 남기기"}
                      </button>
                    </div>
                  </form>
                ) : null}

                <ul id={`replies-${thread.id}`} className={styles.replyList} hidden={!expanded}>
                  {thread.replies.map((reply) => (
                    <li key={reply.id}>
                      <div className={styles.commentMeta}>
                        <strong>{reply.author}</strong>
                        <time dateTime={reply.createdAt}>{formatKoreanDateTime(reply.createdAt)}</time>
                      </div>
                      <p>{reply.body}</p>
                      <ReactionBar
                        reactions={reply.reactions}
                        pickerOpen={reactionPickerId === `reply:${reply.id}`}
                        disabled={commentsLocked || Boolean(pendingAction)}
                        onTogglePicker={() => setReactionPickerId((current) => current === `reply:${reply.id}` ? null : `reply:${reply.id}`)}
                        onReact={(emoji) => reactToReply(reply.id, emoji)}
                      />
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

type ReactionBarProps = {
  reactions: readonly Hello2027Reaction[];
  pickerOpen: boolean;
  disabled?: boolean;
  onTogglePicker: () => void;
  onReact: (emoji: Hello2027Reaction["emoji"]) => void;
};

function ReactionBar({ reactions, pickerOpen, disabled = false, onTogglePicker, onReact }: ReactionBarProps) {
  return (
    <div className={styles.reactionArea}>
      <div className={styles.reactionBar} aria-label="댓글 반응">
        {reactions.map((reaction) => (
          <button
            type="button"
            key={reaction.emoji}
            aria-label={`${REACTION_NAMES[reaction.emoji]} 반응 ${reaction.reacted ? "취소" : "추가"}, 현재 ${reaction.count}개`}
            aria-pressed={reaction.reacted}
            disabled={disabled}
            onClick={() => onReact(reaction.emoji)}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <strong>{reaction.count}</strong>
          </button>
        ))}
        <button
          className={styles.reactionAdd}
          type="button"
          aria-label="이모지 반응 추가"
          aria-expanded={pickerOpen}
          disabled={disabled}
          onClick={onTogglePicker}
        >
          <span aria-hidden="true">＋</span>
        </button>
      </div>
      {pickerOpen && !disabled ? (
        <div className={styles.reactionPicker} role="group" aria-label="추가할 이모지 반응 선택">
          {REACTION_OPTIONS.map((emoji) => (
            <button type="button" key={emoji} aria-label={REACTION_NAMES[emoji]} onClick={() => onReact(emoji)}>
              <span aria-hidden="true">{emoji}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CommentIdentity({ viewer, compact = false }: { viewer: Hello2027Viewer | null; compact?: boolean }) {
  if (!viewer?.authenticated) return null;

  const hasKakaoName = Boolean(viewer?.authenticated && viewer.display_name);
  return (
    <div className={`${styles.commentIdentity} ${compact ? styles.commentIdentityCompact : ""}`}>
      <p>
        {hasKakaoName
          ? <><strong>{viewer?.display_name}</strong> 이름으로 작성됩니다.{viewer?.verified_name ? " 운영자가 크루 명단과 대조한 표시 이름입니다." : " 운영자가 이후 확인 이름으로 변경할 수 있어요."}</>
          : <>카카오 이름을 확인하고 있어요.</>}
      </p>
    </div>
  );
}
