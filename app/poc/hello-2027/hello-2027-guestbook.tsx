"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { KakaoLoginButton } from "@/components/kakao-login-button";
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
type AuthorMode = "kakao" | "anonymous";

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
  const [authorMode, setAuthorMode] = useState<AuthorMode>("kakao");
  const replyTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const commentsLocked = !commentsLive;
  const viewerLoading = externalViewerManaged ? externalViewerLoading : localViewerLoading;
  const canWrite = Boolean(
    commentsLive
    && viewer?.authenticated
    && (authorMode === "anonymous" || viewer.display_name),
  );

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
          setAnnouncement("");
        } else {
          setThreads([]);
          setCommentsLive(false);
          if (payload.error) setAnnouncement(payload.error);
        }
      })
      .catch(() => {
        if (active) {
          setThreads([]);
          setCommentsLive(false);
          setAnnouncement("댓글을 불러오지 못했어요. 네트워크를 확인한 뒤 다시 시도해주세요.");
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
      setValidationMessage("댓글 기능을 잠시 점검하고 있어요.");
      return;
    }
    if (!viewer?.authenticated) {
      setValidationMessage("댓글은 카카오 로그인 후 남길 수 있어요.");
      return;
    }
    if (authorMode === "kakao" && !viewer.display_name) {
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
        body: JSON.stringify({ body, author_mode: authorMode }),
      });
      const payload = await readJson<CommentMutationResponse>(response);
      if (!response.ok || !payload.comment || !("replies" in payload.comment)) {
        throw new Error(payload.error || "댓글을 저장하지 못했어요.");
      }
      setThreads((current) => [payload.comment as Hello2027GuestbookThread, ...current]);
      setDraft("");
      setValidationMessage("");
      setAnnouncement(authorMode === "anonymous"
        ? "익명으로 이야기를 남겼어요."
        : `${viewer.display_name} 이름으로 이야기를 남겼어요.`);
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
      setAnnouncement("댓글 기능을 잠시 점검하고 있어요.");
      return;
    }
    if (!viewer?.authenticated) {
      setAnnouncement("답글은 카카오 로그인 후 남길 수 있어요.");
      return;
    }
    if (authorMode === "kakao" && !viewer.display_name) {
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
          author_mode: authorMode,
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
      setAnnouncement(authorMode === "anonymous"
        ? "익명으로 답글을 남겼어요."
        : `${viewer.display_name} 이름으로 답글을 남겼어요.`);
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : "답글을 저장하지 못했어요.");
    } finally {
      setPendingAction(null);
    }
  };

  const reactToComment = async (commentId: string, emoji: Hello2027Reaction["emoji"]) => {
    if (commentsLocked || !viewer?.authenticated) {
      setAnnouncement("댓글 반응은 카카오 로그인 후 남길 수 있어요.");
      return;
    }
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
        {!viewerLoading && !viewer?.authenticated ? (
          <div className={styles.loginPromptTitle}>로그인해야 댓글을 남길 수 있어요</div>
        ) : null}
      </div>

      {commentsLoading ? (
        <p className={styles.guestbookAnnouncement} role="status">
          공용 댓글을 확인하고 있어요.
        </p>
      ) : null}

      {viewerLoading ? (
        <div className={styles.guestbookComposer} role="status">로그인 상태를 확인하고 있어요.</div>
      ) : viewer?.authenticated ? (
        <form className={styles.guestbookComposer} onSubmit={submitThread} aria-describedby="guestbook-help guestbook-error">
          <AuthorModeChoice viewer={viewer} value={authorMode} onChange={setAuthorMode} />
          <label className={styles.bodyLabel} htmlFor="guestbook-body">하고 싶은 이야기</label>
          <textarea
            id="guestbook-body"
            value={draft}
            maxLength={MAX_GUESTBOOK_BODY_LENGTH}
            required
            disabled={!canWrite || Boolean(pendingAction)}
            placeholder={commentsLocked
              ? "댓글 기능을 잠시 점검하고 있어요."
              : "기록 수정, 광고 배너 문의 및 오류 제보, 하고 싶은 말 모두 자유롭게 써주세요"}
            onChange={(event) => {
              setDraft(event.target.value);
              if (validationMessage) setValidationMessage("");
            }}
          />
          <div className={styles.composerFooter}>
            <div>
              <p id="guestbook-help">
                {commentsLocked
                  ? "현재 입력 기능을 점검하고 있어요."
                  : authorMode === "anonymous"
                    ? "다른 사람에게는 ‘익명’으로 보여요. 안전한 운영과 남용 방지를 위한 계정 연결만 유지합니다."
                    : `${viewer.display_name} 이름으로 보여요.`}
              </p>
              <p id="guestbook-error" className={styles.formError}>{validationMessage}</p>
            </div>
            <span>{draft.length}/{MAX_GUESTBOOK_BODY_LENGTH}</span>
            <button type="submit" disabled={!canWrite || Boolean(pendingAction)}>
              {commentsLocked ? "점검 중" : pendingAction === "thread:create" ? "남기는 중" : "댓글 남기기"}
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.guestbookComposer}>
          <p className={styles.loginPromptBody}>댓글은 누구나 읽을 수 있고, 카카오 로그인 후 내 닉네임 또는 익명을 선택해 작성할 수 있어요.</p>
          <div className={styles.loginPromptAction}>
            <KakaoLoginButton nextPath="/4th/dashboard#guestbook" label="카카오로 로그인" />
          </div>
        </div>
      )}

      <p className={styles.guestbookAnnouncement} role="status" aria-live="polite">{announcement}</p>

      {!commentsLoading && commentsLive && threads.length === 0 ? (
        <p className={styles.guestbookEmpty}>아직 댓글이 없어요</p>
      ) : null}

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
                  disabled={commentsLocked || !viewer?.authenticated || Boolean(pendingAction)}
                  onTogglePicker={() => setReactionPickerId((current) => current === `thread:${thread.id}` ? null : `thread:${thread.id}`)}
                  onReact={(emoji) => reactToThread(thread.id, emoji)}
                />

                <div className={styles.threadActions}>
                  {viewer?.authenticated ? (
                    <button
                      ref={(node) => { replyTriggerRefs.current[thread.id] = node; }}
                      type="button"
                      disabled={commentsLocked || viewerLoading || Boolean(pendingAction)}
                      onClick={() => openReplyForm(thread.id)}
                    >
                      답글 달기
                    </button>
                  ) : null}
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

                {viewer?.authenticated && replyTargetId === thread.id ? (
                  <form className={styles.replyComposer} onSubmit={(event) => submitReply(event, thread.id)}>
                    <AuthorModeChoice viewer={viewer} value={authorMode} onChange={setAuthorMode} compact />
                    <label className={styles.bodyLabel} htmlFor={`reply-body-${thread.id}`}>답글</label>
                    <textarea
                      id={`reply-body-${thread.id}`}
                      value={replyDrafts[thread.id] ?? ""}
                      maxLength={MAX_GUESTBOOK_BODY_LENGTH}
                      required
                      disabled={!canWrite || Boolean(pendingAction)}
                      placeholder="답글을 입력해주세요."
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))}
                    />
                    <div className={styles.replyFooter}>
                      <span>{(replyDrafts[thread.id] ?? "").length}/{MAX_GUESTBOOK_BODY_LENGTH}</span>
                      <button type="button" disabled={Boolean(pendingAction)} onClick={() => closeReplyForm(thread.id)}>취소</button>
                      <button type="submit" disabled={!canWrite || Boolean(pendingAction)}>
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
                        disabled={commentsLocked || !viewer?.authenticated || Boolean(pendingAction)}
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

function AuthorModeChoice({
  viewer,
  value,
  onChange,
  compact = false,
}: {
  viewer: Hello2027Viewer;
  value: AuthorMode;
  onChange: (value: AuthorMode) => void;
  compact?: boolean;
}) {
  return (
    <fieldset className={`${styles.authorChoice} ${compact ? styles.authorChoiceCompact : ""}`}>
      <legend>댓글에 표시할 이름</legend>
      <div className={styles.authorModeButtons}>
        <button
          type="button"
          aria-pressed={value === "kakao"}
          disabled={!viewer.display_name}
          onClick={() => onChange("kakao")}
        >
          {viewer.display_name || "내 닉네임"}
        </button>
        <button type="button" aria-pressed={value === "anonymous"} onClick={() => onChange("anonymous")}>
          익명
        </button>
      </div>
    </fieldset>
  );
}
