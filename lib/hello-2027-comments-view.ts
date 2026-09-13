import type { Hello2027GuestbookThread } from "@/lib/hello-2027-types";

/**
 * Deleted top-level comments are retained in storage so their replies keep a
 * valid parent, but the whole thread is removed from the public dashboard.
 */
export function isHello2027PublicThreadStatus(status: unknown): status is "visible" {
  return status === "visible";
}

/** Removes either a whole thread or one reply from the currently rendered list. */
export function removeHello2027CommentFromView(
  threads: readonly Hello2027GuestbookThread[],
  commentId: string,
): Hello2027GuestbookThread[] {
  return threads.flatMap<Hello2027GuestbookThread>((thread) => {
    if (thread.id === commentId) return [];

    return [{
      ...thread,
      replies: thread.replies.filter((reply) => reply.id !== commentId),
    }];
  });
}

/** Preserve replies and reactions when an edit response contains only text. */
export function updateHello2027CommentInView(
  threads: readonly Hello2027GuestbookThread[],
  change: { id: string; body: string; updatedAt?: string },
): Hello2027GuestbookThread[] {
  return threads.map(thread => thread.id === change.id
    ? { ...thread, body: change.body, updatedAt: change.updatedAt }
    : { ...thread, replies: thread.replies.map(reply => reply.id === change.id
      ? { ...reply, body: change.body, updatedAt: change.updatedAt }
      : reply) });
}
