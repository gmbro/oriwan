import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type HardDeletedHello2027Comment = {
  id: string;
  parent_id: string | null;
};

export type HardDeleteHello2027CommentResult = {
  data: HardDeletedHello2027Comment | null;
  error: PostgrestError | null;
};

/**
 * Permanently deletes one comment in a single PostgreSQL statement.
 *
 * The schema owns the dependent-row policy: both `comments.parent_id` and
 * `comment_reactions.comment_id` use `ON DELETE CASCADE`. Deleting only the
 * root row therefore removes a full thread (or one reply) and all associated
 * reactions atomically, without a partial "reactions removed, comment kept"
 * state when a later request fails.
 */
export async function hardDeleteAdminHello2027Comment(
  service: SupabaseClient,
  commentId: string,
  seasonKey: string,
): Promise<HardDeleteHello2027CommentResult> {
  const result = await service
    .from("hello_2027_comments")
    .delete()
    .eq("id", commentId)
    .eq("season_key", seasonKey)
    .select("id, parent_id")
    .maybeSingle();

  return {
    data: result.data as HardDeletedHello2027Comment | null,
    error: result.error,
  };
}
