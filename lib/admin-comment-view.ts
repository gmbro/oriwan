export type AdminCommentViewRow = {
  id: string;
  parent_id: string | null;
  status?: string;
};

/** Keeps hard-deleted rows, their replies, and legacy delete placeholders out of the admin list. */
export function filterAdminCommentsAfterHardDelete<T extends AdminCommentViewRow>(
  comments: readonly T[],
  deletedCommentIds: ReadonlySet<string>,
  deletedThreadIds: ReadonlySet<string>,
): T[] {
  return comments.filter((comment) => (
    comment.status !== "deleted"
    && !deletedCommentIds.has(comment.id)
    && !(comment.parent_id && deletedThreadIds.has(comment.parent_id))
  ));
}

/** Optimistically mirrors the database cascade policy for one admin deletion. */
export function removeAdminCommentFromView<T extends AdminCommentViewRow>(
  comments: readonly T[],
  commentId: string,
): T[] {
  const target = comments.find((comment) => comment.id === commentId);
  const deletesWholeThread = target?.parent_id === null;

  return comments.filter((comment) => (
    comment.id !== commentId
    && !(deletesWholeThread && comment.parent_id === commentId)
  ));
}
