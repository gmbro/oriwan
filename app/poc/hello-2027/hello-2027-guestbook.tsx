"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  MAX_GUESTBOOK_BODY_LENGTH,
  readLocalGuestbook,
  writeLocalGuestbook,
} from "./hello-2027-local-repository";
import type {
  Hello2027AuthorMode,
  Hello2027GuestbookThread,
  Hello2027Reaction,
} from "./hello-2027-poc-data";
import styles from "./hello-2027-poc.module.css";

type Hello2027GuestbookProps = {
  initialThreads: readonly Hello2027GuestbookThread[];
  previewOnly?: boolean;
};

type Hello2027Viewer = {
  authenticated: boolean;
  provider: "kakao" | null;
  display_name: string | null;
  approved_participant: boolean;
  verified_name?: boolean;
  connection_status?: string;
};

const RANDOM_NICKNAMES = [
  "새벽다람쥐", "포근한구름", "아침참새", "파란물결", "느긋한수달", "달빛토끼",
  "산책고양이", "초록바람", "작은반달", "강변여우", "졸린판다", "햇살두더지",
  "말랑한별", "노을오리", "러닝펭귄", "민들레씨", "고요한사슴", "새벽반딧불",
  "단풍고슴도치", "구름너구리", "아침해달", "푸른솔방울", "따뜻한보폭", "느린유성",
] as const;

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

function createLocalId(prefix: string) {
  const randomId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${randomId}`;
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

function pickRandomNickname() {
  if (typeof crypto.getRandomValues === "function") {
    const randomValue = new Uint32Array(1);
    crypto.getRandomValues(randomValue);
    return RANDOM_NICKNAMES[randomValue[0] % RANDOM_NICKNAMES.length];
  }
  return RANDOM_NICKNAMES[Math.floor(Math.random() * RANDOM_NICKNAMES.length)];
}

function normalizeDisplayName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toggleReaction(
  reactions: readonly Hello2027Reaction[],
  emoji: Hello2027Reaction["emoji"],
): Hello2027Reaction[] {
  const existing = reactions.find((reaction) => reaction.emoji === emoji);
  if (!existing) return [...reactions, { emoji, count: 1, reacted: true }];

  const nextCount = existing.reacted ? existing.count - 1 : Math.min(9_999, existing.count + 1);
  if (nextCount <= 0) return reactions.filter((reaction) => reaction.emoji !== emoji);
  return reactions.map((reaction) => reaction.emoji === emoji
    ? { ...reaction, count: nextCount, reacted: !reaction.reacted }
    : { ...reaction });
}

export function Hello2027Guestbook({ initialThreads, previewOnly = false }: Hello2027GuestbookProps) {
  const [threads, setThreads] = useState<Hello2027GuestbookThread[]>(() => cloneThreads(initialThreads));
  const [draft, setDraft] = useState("");
  const [viewer, setViewer] = useState<Hello2027Viewer | null>(null);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(() => new Set());
  const [validationMessage, setValidationMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const replyTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    let active = true;
    void fetch("/api/hello-2027/viewer", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<Hello2027Viewer>;
      })
      .then((nextViewer) => {
        if (active && nextViewer) setViewer(nextViewer);
      })
      .catch(() => undefined);
    if (!previewOnly) {
      void readLocalGuestbook()
        .then((storedThreads) => {
          if (active && storedThreads) setThreads(cloneThreads(storedThreads));
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [previewOnly]);

  const persistThreads = (nextThreads: Hello2027GuestbookThread[]) => {
    setThreads(nextThreads);
    void writeLocalGuestbook(nextThreads).catch(() => {
      setAnnouncement("댓글은 화면에 추가됐지만 이 브라우저에 저장하지 못했어요.");
    });
  };

  const submitThread = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (previewOnly) {
      setValidationMessage("오픈 전 미리보기에서는 댓글을 저장하지 않아요.");
      return;
    }
    if (viewer?.authenticated && (!viewer.verified_name || !viewer.display_name)) {
      setValidationMessage("운영자가 이름을 확인한 뒤 확인된 이름으로 댓글을 남길 수 있어요.");
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
    const kakaoName = viewer?.authenticated ? normalizeDisplayName(viewer.display_name || "") : "";
    const authorMode: Hello2027AuthorMode = kakaoName ? "kakao" : "random";

    const nextThread: Hello2027GuestbookThread = {
      id: createLocalId("thread"),
      author: kakaoName || pickRandomNickname(),
      authorMode,
      body,
      createdAt: new Date().toISOString(),
      reactions: [],
      replies: [],
    };
    persistThreads([nextThread, ...threads]);
    setDraft("");
    setValidationMessage("");
    setAnnouncement(kakaoName ? `${kakaoName} 이름으로 이야기를 남겼어요.` : "익명 닉네임으로 이야기를 남겼어요.");
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

  const submitReply = (event: FormEvent<HTMLFormElement>, threadId: string) => {
    event.preventDefault();
    if (previewOnly) {
      setAnnouncement("오픈 전 미리보기에서는 답글을 저장하지 않아요.");
      return;
    }
    if (viewer?.authenticated && (!viewer.verified_name || !viewer.display_name)) {
      setAnnouncement("운영자가 이름을 확인한 뒤 확인된 이름으로 답글을 남길 수 있어요.");
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
    const kakaoName = viewer?.authenticated ? normalizeDisplayName(viewer.display_name || "") : "";
    const replyAuthorMode: Hello2027AuthorMode = kakaoName ? "kakao" : "random";
    const author = kakaoName || pickRandomNickname();

    const nextThreads = threads.map((thread) => thread.id === threadId
      ? {
          ...thread,
          replies: [
            ...thread.replies,
            {
              id: createLocalId("reply"),
              author,
              authorMode: replyAuthorMode,
              body,
              createdAt: new Date().toISOString(),
              reactions: [],
            },
          ],
        }
      : thread);
    persistThreads(nextThreads);
    setReplyDrafts((current) => ({ ...current, [threadId]: "" }));
    setExpandedThreadIds((current) => new Set(current).add(threadId));
    setReplyTargetId(null);
    setAnnouncement(kakaoName ? `${kakaoName} 이름으로 답글을 남겼어요.` : "익명 닉네임으로 답글을 남겼어요.");
  };

  const reactToThread = (threadId: string, emoji: Hello2027Reaction["emoji"]) => {
    const nextThreads = threads.map((thread) => thread.id === threadId
      ? { ...thread, reactions: toggleReaction(thread.reactions, emoji) }
      : thread);
    persistThreads(nextThreads);
    setReactionPickerId(null);
    setAnnouncement(`${REACTION_NAMES[emoji]} 반응을 업데이트했어요.`);
  };

  const reactToReply = (
    threadId: string,
    replyId: string,
    emoji: Hello2027Reaction["emoji"],
  ) => {
    const nextThreads = threads.map((thread) => thread.id === threadId
      ? {
          ...thread,
          replies: thread.replies.map((reply) => reply.id === replyId
            ? { ...reply, reactions: toggleReaction(reply.reactions, emoji) }
            : reply),
        }
      : thread);
    persistThreads(nextThreads);
    setReactionPickerId(null);
    setAnnouncement(`${REACTION_NAMES[emoji]} 반응을 업데이트했어요.`);
  };

  return (
    <section id="guestbook" className={styles.guestbookSection} aria-labelledby="guestbook-title">
      <div className={styles.guestbookHeading}>
        <h2 id="guestbook-title">댓글</h2>
        <p>문의사항이나 하고 싶은 이야기 떠들어재끼기</p>
      </div>

      {previewOnly ? (
        <p className={styles.guestbookAnnouncement} role="status">
          지금은 더미 댓글을 보여주는 읽기 전용 미리보기예요. 공용 댓글 저장소와 운영자 관리가 연결된 뒤 열립니다.
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
          disabled={previewOnly}
          placeholder={previewOnly ? "정식 오픈 후 댓글을 남길 수 있어요." : "오늘의 느낌이나 궁금한 점을 적어주세요."}
          onChange={(event) => {
            setDraft(event.target.value);
            if (validationMessage) setValidationMessage("");
          }}
        />
        <div className={styles.composerFooter}>
          <div>
            <p id="guestbook-help">{previewOnly ? "현재 입력 기능은 잠겨 있어요." : "카카오 로그인 시 운영자가 확인한 이름, 미로그인 시 랜덤 익명 닉네임으로 표시됩니다."}</p>
            <p id="guestbook-error" className={styles.formError}>{validationMessage}</p>
          </div>
          <span>{draft.length}/{MAX_GUESTBOOK_BODY_LENGTH}</span>
          <button type="submit" disabled={previewOnly || Boolean(viewer?.authenticated && !viewer.verified_name)}>
            {previewOnly ? "오픈 준비 중" : viewer?.authenticated ? viewer.verified_name ? "확인 이름으로 남기기" : "이름 확인 중" : "익명으로 남기기"}
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
                  disabled={previewOnly}
                  onTogglePicker={() => setReactionPickerId((current) => current === `thread:${thread.id}` ? null : `thread:${thread.id}`)}
                  onReact={(emoji) => reactToThread(thread.id, emoji)}
                />

                <div className={styles.threadActions}>
                  <button
                    ref={(node) => { replyTriggerRefs.current[thread.id] = node; }}
                    type="button"
                    disabled={previewOnly}
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
                      placeholder="답글을 입력해주세요."
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))}
                    />
                    <div className={styles.replyFooter}>
                      <span>{(replyDrafts[thread.id] ?? "").length}/{MAX_GUESTBOOK_BODY_LENGTH}</span>
                      <button type="button" onClick={() => closeReplyForm(thread.id)}>취소</button>
                      <button type="submit" disabled={Boolean(viewer?.authenticated && !viewer.verified_name)}>답글 남기기</button>
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
                        disabled={previewOnly}
                        onTogglePicker={() => setReactionPickerId((current) => current === `reply:${reply.id}` ? null : `reply:${reply.id}`)}
                        onReact={(emoji) => reactToReply(thread.id, reply.id, emoji)}
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
  const isVerifiedMember = Boolean(viewer?.authenticated && viewer.verified_name && viewer.display_name);
  return (
    <div className={`${styles.commentIdentity} ${compact ? styles.commentIdentityCompact : ""}`}>
      <span className={viewer?.authenticated ? styles.kakaoIdentity : styles.anonymousIdentity}>
        {viewer?.authenticated ? isVerifiedMember ? "확인 이름" : "확인 중" : "익명"}
      </span>
      <p>
        {isVerifiedMember
          ? <><strong>{viewer?.display_name}</strong> 이름으로 작성됩니다.</>
          : viewer?.authenticated
            ? <>운영자가 크루와 이름을 확인하면 확인된 이름으로 댓글을 남길 수 있어요.</>
            : <>등록할 때 포근한 랜덤 닉네임을 정해드려요. <Link href="#member-features">카카오 로그인</Link></>}
      </p>
    </div>
  );
}
