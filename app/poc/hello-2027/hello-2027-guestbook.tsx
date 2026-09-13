"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { HELLO_2027_COMMENT_BODY_MAX_LENGTH } from "@/lib/hello-2027-comments-contract";
import { removeHello2027CommentFromView, updateHello2027CommentInView } from "@/lib/hello-2027-comments-view";
import { DASHBOARD_REFRESH_DOM_EVENT } from "@/lib/dashboard-refresh-contract";
import type {
  Hello2027GuestbookThread,
  Hello2027Reaction,
} from "@/lib/hello-2027-types";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import styles from "./hello-2027-poc.module.css";

type Hello2027GuestbookProps = {
  initialThreads: readonly Hello2027GuestbookThread[];
  externalViewer?: Hello2027Viewer | null;
  externalViewerManaged?: boolean;
  externalViewerLoading?: boolean;
  management?: boolean;
  request?: typeof fetch;
  onMutation?: () => void;
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

type CommentDeleteResponse = {
  ok?: boolean;
  id?: string;
  status?: "deleted";
  error?: string;
};

type CommentDeleteTarget = {
  id: string;
  label: "댓글" | "답글";
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

const KOREAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatKoreanDateTime(value: string) {
  return KOREAN_DATE_TIME_FORMATTER.format(new Date(value));
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({})) as Promise<T>;
}

function announceGuestbookMutation() {
  void import("@/lib/dashboard-refresh")
    .then(({ broadcastDashboardRefresh }) => broadcastDashboardRefresh())
    .catch(() => undefined);
}

export function Hello2027Guestbook({
  initialThreads,
  externalViewer,
  externalViewerManaged = false,
  externalViewerLoading = false,
  management = false,
  request = fetch,
  onMutation = announceGuestbookMutation,
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
  const [deleteError, setDeleteError] = useState("");
  const deleteInFlight = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<CommentDeleteTarget | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; label: "댓글" | "답글"; body: string; version: string } | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const commentsReadVersion = useRef(0);
  const guestbookSectionRef = useRef<HTMLElement | null>(null);
  const replyTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const deleteTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const removedCommentIdsRef = useRef<Set<string>>(new Set());
  const commentsLocked = !commentsLive;
  const viewerLoading = externalViewerManaged ? externalViewerLoading : localViewerLoading;
  const canWrite = Boolean(
    commentsLive
    && viewer?.authenticated
    && (authorMode === "anonymous" || viewer.display_name),
  );

  const closeDeleteDialog = useCallback(() => {
    const targetId = deleteTarget?.id;
    setDeleteTarget(null);
    setDeleteError("");
    if (targetId) {
      window.requestAnimationFrame(() => deleteTriggerRefs.current[targetId]?.focus());
    }
  }, [deleteTarget]);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let queued = false;
    let controller: AbortController | null = null;
    if (!externalViewerManaged) {
      void request("/api/hello-2027/viewer", { cache: "no-store" })
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
    const refreshComments = () => {
      if (!active) return;
      if (inFlight) { queued = true; return; }
      inFlight = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10_000);
      const readVersion = ++commentsReadVersion.current;
      void request("/api/hello-2027/comments", { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const payload = await readJson<CommentsReadResponse>(response);
          if (!active || readVersion !== commentsReadVersion.current) return;
          if (response.ok && payload.live && Array.isArray(payload.threads)) {
            const refreshedThreads = Array.from(removedCommentIdsRef.current).reduce(
              (current, removedId) => removeHello2027CommentFromView(current, removedId),
              cloneThreads(payload.threads),
            );
            setThreads(refreshedThreads);
            setCommentsLive(true);
            setAnnouncement("");
          } else {
            setCommentsLive(false);
            if (payload.error) setAnnouncement(payload.error);
          }
        })
        .catch(() => {
          if (active && readVersion === commentsReadVersion.current) {
            setAnnouncement("댓글을 불러오지 못했어요. 네트워크를 확인한 뒤 다시 시도해주세요.");
          }
        })
        .finally(() => {
          window.clearTimeout(timeout);
          controller = null;
          inFlight = false;
          if (active && readVersion === commentsReadVersion.current) setCommentsLoading(false);
          if (active && queued) { queued = false; refreshComments(); }
        });
    };
    refreshComments();
    window.addEventListener(DASHBOARD_REFRESH_DOM_EVENT, refreshComments);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener(DASHBOARD_REFRESH_DOM_EVENT, refreshComments);
    };
  }, [externalViewerManaged, externalViewer?.authenticated, externalViewer?.display_name, request]);

  const startEdit = (comment: Hello2027GuestbookThread | Hello2027GuestbookThread["replies"][number], label: "댓글" | "답글") => {
    setEditTarget({ id: comment.id, label, body: comment.body, version: comment.updatedAt ?? comment.createdAt });
    setEditDraft(comment.body);
    setEditError("");
    requestAnimationFrame(() => document.getElementById(`comment-edit-${comment.id}`)?.focus());
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTarget || pendingAction || commentsLocked || !viewer?.authenticated) return;
    const target = editTarget;
    const body = editDraft.trim();
    if (!body || body.length > MAX_GUESTBOOK_BODY_LENGTH) { setEditError("수정할 내용을 150자 이내로 입력해주세요."); return; }
    setPendingAction(`edit:${target.id}`); setEditError("");
    try {
      const response = await request("/api/hello-2027/comments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, body, expected_updated_at: target.version }),
      });
      const payload = await readJson<CommentMutationResponse>(response);
      if (!response.ok || payload.comment?.id !== target.id) throw new Error(payload.error || "수정하지 못했어요.");
      // Ignore any GET begun before this confirmed edit. Never replace the whole
      // thread with the PATCH response: replies/reactions are independently owned.
      ++commentsReadVersion.current;
      setThreads(current => updateHello2027CommentInView(current, payload.comment!));
      setEditTarget(null); setEditDraft("");
      setAnnouncement(`${target.label}을 수정했어요.`);
      onMutation();
    } catch (error) { setEditError(error instanceof Error ? error.message : "수정하지 못했어요."); }
    finally { setPendingAction(null); }
  };

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
      const response = await request("/api/hello-2027/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, author_mode: authorMode }),
      });
      const payload = await readJson<CommentMutationResponse>(response);
      if (!response.ok || !payload.comment || !("replies" in payload.comment)) {
        throw new Error(payload.error || "댓글을 저장하지 못했어요.");
      }
      // The POST response intentionally does not expose actor_key; the current
      // authenticated creator can safely receive the local ownership affordance.
      setThreads((current) => [{
        ...(payload.comment as Hello2027GuestbookThread),
        ownedByViewer: true,
      }, ...current]);
      setDraft("");
      setValidationMessage("");
      setAnnouncement(authorMode === "anonymous"
        ? "익명으로 이야기를 남겼어요."
        : `${viewer.display_name} 이름으로 이야기를 남겼어요.`);
      onMutation();
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
      const response = await request("/api/hello-2027/comments", {
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
        ? {
          ...thread,
          replies: [...thread.replies, {
            ...(payload.comment as Hello2027GuestbookThread["replies"][number]),
            ownedByViewer: true,
          }],
        }
        : thread));
      setReplyDrafts((current) => ({ ...current, [threadId]: "" }));
      setExpandedThreadIds((current) => new Set(current).add(threadId));
      setReplyTargetId(null);
      setAnnouncement(authorMode === "anonymous"
        ? "익명으로 답글을 남겼어요."
        : `${viewer.display_name} 이름으로 답글을 남겼어요.`);
      onMutation();
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
      const response = await request("/api/hello-2027/comments/reactions", {
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
      onMutation();
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

  const deleteComment = async () => {
    if (!deleteTarget || pendingAction || deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeleteError("");
    const { id, label } = deleteTarget;

    // Keep the dialog open until the server confirms deletion.
    setPendingAction(`delete:${id}`);

    setReplyTargetId((current) => current === id ? null : current);
    setReactionPickerId((current) => current?.endsWith(`:${id}`) ? null : current);
    setAnnouncement(`${label}을 삭제하고 있어요.`);

    try {
      const response = await request("/api/hello-2027/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await readJson<CommentDeleteResponse>(response);
      if (!response.ok || !payload.ok || payload.id !== id) {
        throw new Error(payload.error || `${label}을 삭제하지 못했어요.`);
      }
      removedCommentIdsRef.current.add(id);
      setThreads((current) => removeHello2027CommentFromView(current, id));
      closeDeleteDialog();
      setAnnouncement(`${label}을 삭제했어요.`);
      window.requestAnimationFrame(() => guestbookSectionRef.current?.focus({ preventScroll: true }));
      onMutation();
    } catch (error) {
      removedCommentIdsRef.current.delete(id);
      const message = error instanceof Error ? error.message : `${label}을 삭제하지 못했어요.`;
      setDeleteError(message);
      setAnnouncement(message);
    } finally {
      deleteInFlight.current = false;
      setPendingAction(null);
    }
  };

  return (
    <section
      ref={guestbookSectionRef}
      id={management ? "managed-guestbook" : "guestbook"}
      style={management ? { width: "100%", margin: 0 } : undefined}
      className={styles.guestbookSection}
      aria-labelledby={management ? "managed-guestbook-title" : "guestbook-title"}
      tabIndex={-1}
    >
      <div className={styles.guestbookHeading}>
        <h2 id={management ? "managed-guestbook-title" : "guestbook-title"}>댓글</h2>
        {!viewerLoading && !viewer?.authenticated ? (
          <p className={styles.loginPromptTitle}>로그인해야 댓글을 남길 수 있어요</p>
        ) : null}
      </div>

      {commentsLoading ? (
        <p className={styles.guestbookAnnouncement} role="status">
          공용 댓글을 확인하고 있어요.
        </p>
      ) : null}

      {viewerLoading ? (
        <p className={styles.guestbookAnnouncement} role="status">로그인 상태를 확인하고 있어요.</p>
      ) : viewer?.authenticated ? (
        <form className={styles.guestbookComposer} onSubmit={submitThread} aria-describedby={validationMessage ? "guestbook-help guestbook-error" : "guestbook-help"}>
          <label className={styles.bodyLabel} htmlFor="guestbook-body">내용</label>
          <textarea
            id="guestbook-body"
            value={draft}
            maxLength={MAX_GUESTBOOK_BODY_LENGTH}
            required
            disabled={!canWrite || Boolean(pendingAction)}
            placeholder={commentsLocked
              ? commentsLoading ? "댓글을 불러오고 있어요." : "댓글 연결 상태를 확인해주세요."
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
              {validationMessage ? <p id="guestbook-error" className={styles.formError} role="alert">{validationMessage}</p> : null}
            </div>
            <span>{draft.length}/{MAX_GUESTBOOK_BODY_LENGTH}</span>
            <div className={styles.composerActions}>
              <AnonymousChoice value={authorMode} onChange={setAuthorMode} disabled={Boolean(pendingAction)} />
              <button type="submit" disabled={!canWrite || Boolean(pendingAction)}>
                {commentsLoading ? "불러오는 중…" : commentsLocked ? "연결 확인 필요" : pendingAction === "thread:create" ? "남기는 중" : "댓글 남기기"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {announcement ? <p className={styles.guestbookAnnouncement} role="status" aria-live="polite">{announcement}</p> : null}

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
                  <CommentTimestamp createdAt={thread.createdAt} updatedAt={thread.updatedAt} />
                </div>
                {editTarget?.id === thread.id ? <CommentEditor id={thread.id} label="댓글" draft={editDraft} onChange={setEditDraft} onCancel={() => setEditTarget(null)} onSubmit={saveEdit} error={editError} busy={Boolean(pendingAction)} unchanged={editDraft.trim() === editTarget.body} /> : <p className={styles.threadBody}>{thread.body}</p>}
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
                  {thread.ownedByViewer && viewer?.authenticated ? (<>
                    <button type="button" aria-label="내 댓글 수정" disabled={commentsLocked || Boolean(pendingAction) || Boolean(editTarget)} onClick={() => startEdit(thread, "댓글")}>수정</button>
                    <button
                      ref={(node) => { deleteTriggerRefs.current[thread.id] = node; }}
                      className={styles.commentDeleteButton}
                      type="button"
                      disabled={commentsLocked || Boolean(pendingAction)}
                      onClick={() => setDeleteTarget({ id: thread.id, label: "댓글" })}
                    >
                      삭제
                    </button>
                  </>) : null}
                  {thread.replies.length > 0 ? (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`${management ? "managed-" : ""}replies-${thread.id}`}
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
                      <AnonymousChoice value={authorMode} onChange={setAuthorMode} disabled={Boolean(pendingAction)} />
                      <button type="button" disabled={Boolean(pendingAction)} onClick={() => closeReplyForm(thread.id)}>취소</button>
                      <button type="submit" disabled={!canWrite || Boolean(pendingAction)}>
                        {pendingAction === `reply:${thread.id}` ? "남기는 중" : "답글 남기기"}
                      </button>
                    </div>
                  </form>
                ) : null}

                <ul id={`${management ? "managed-" : ""}replies-${thread.id}`} className={styles.replyList} hidden={!expanded}>
                  {thread.replies.map((reply) => (
                    <li key={reply.id}>
                      <div className={styles.commentMeta}>
                        <strong>{reply.author}</strong>
                        <CommentTimestamp createdAt={reply.createdAt} updatedAt={reply.updatedAt} />
                      </div>
                      {editTarget?.id === reply.id ? <CommentEditor id={reply.id} label="답글" draft={editDraft} onChange={setEditDraft} onCancel={() => setEditTarget(null)} onSubmit={saveEdit} error={editError} busy={Boolean(pendingAction)} unchanged={editDraft.trim() === editTarget.body} /> : <p>{reply.body}</p>}
                      <ReactionBar
                        reactions={reply.reactions}
                        pickerOpen={reactionPickerId === `reply:${reply.id}`}
                        disabled={commentsLocked || !viewer?.authenticated || Boolean(pendingAction)}
                        onTogglePicker={() => setReactionPickerId((current) => current === `reply:${reply.id}` ? null : `reply:${reply.id}`)}
                        onReact={(emoji) => reactToReply(reply.id, emoji)}
                      />
                      {reply.ownedByViewer && viewer?.authenticated ? (
                        <div className={styles.replyActions}>
                          <button type="button" aria-label="내 답글 수정" disabled={commentsLocked || Boolean(pendingAction) || Boolean(editTarget)} onClick={() => startEdit(reply, "답글")}>수정</button>
                          <button
                            ref={(node) => { deleteTriggerRefs.current[reply.id] = node; }}
                            className={styles.commentDeleteButton}
                            type="button"
                            disabled={commentsLocked || Boolean(pendingAction)}
                            onClick={() => setDeleteTarget({ id: reply.id, label: "답글" })}
                          >
                            삭제
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          );
        })}
      </ol>

      {deleteTarget && <ConfirmationDialog
        title={`${deleteTarget.label}을 삭제할까요?`}
        description="삭제한 뒤에는 되돌릴 수 없어요."
        busy={Boolean(pendingAction)}
        onCancel={closeDeleteDialog}
        onConfirm={() => void deleteComment()}
      >
        {deleteError && <p role="alert">{deleteError}</p>}
      </ConfirmationDialog>}
    </section>
  );
}

function CommentTimestamp({ createdAt, updatedAt }: { createdAt: string; updatedAt?: string }) {
  return <div className={styles.commentTimestamps}>
    {updatedAt && Date.parse(updatedAt) > Date.parse(createdAt)
      ? <time dateTime={updatedAt}>수정 {formatKoreanDateTime(updatedAt)}</time>
      : <time dateTime={createdAt}>{formatKoreanDateTime(createdAt)}</time>}
  </div>;
}

function CommentEditor({ id, label, draft, onChange, onCancel, onSubmit, error, busy, unchanged }: {
  id: string; label: string; draft: string; onChange: (value: string) => void; onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string; busy: boolean; unchanged: boolean;
}) {
  return <form className={styles.replyComposer} onSubmit={onSubmit}>
    <label className={styles.bodyLabel} htmlFor={`comment-edit-${id}`}>{label} 수정</label>
    <textarea id={`comment-edit-${id}`} value={draft} onChange={event => onChange(event.target.value)} maxLength={MAX_GUESTBOOK_BODY_LENGTH} required disabled={busy} />
    {error && <p className={styles.formError} role="alert">{error}</p>}
    <div className={styles.replyFooter}>
      <span>{draft.length}/{MAX_GUESTBOOK_BODY_LENGTH}</span>
      <button type="button" disabled={busy} onClick={onCancel}>취소</button>
      <button type="submit" disabled={busy || unchanged || !draft.trim()}>{busy ? "저장 중…" : "저장"}</button>
    </div>
  </form>;
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

function AnonymousChoice({
  value,
  onChange,
  disabled = false,
}: {
  value: AuthorMode;
  onChange: (value: AuthorMode) => void;
  disabled?: boolean;
}) {
  return (
    <label className={styles.anonymousChoice}>
      <input type="checkbox" checked={value === "anonymous"} disabled={disabled}
        onChange={(event) => onChange(event.target.checked ? "anonymous" : "kakao")} />
      <span>익명으로 남기기</span>
    </label>
  );
}
