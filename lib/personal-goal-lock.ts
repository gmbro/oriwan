export const PERSONAL_GOAL_CHANGE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
export function personalGoalEditWindow(createdAt: string | null, now = Date.now()) {
  if (!createdAt) return { can_edit: true, editable_at: null };
  const editableAt = Date.parse(createdAt) + PERSONAL_GOAL_CHANGE_INTERVAL_MS;
  return { can_edit: Number.isFinite(editableAt) && now >= editableAt, editable_at: Number.isFinite(editableAt) ? new Date(editableAt).toISOString() : null };
}
