import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findAdminUserId } from "@/lib/admin-data";
import { isMissingTableError } from "@/lib/supabase-errors";

export type ParticipantAccountConnectionStatus =
  | "approved"
  | "pending"
  | "revoked"
  | "unlinked"
  | "invalid"
  | "setup_required"
  | "admin_missing";

export type ApprovedParticipant = {
  id: string;
  name: string;
  active: boolean;
  display_order: number;
  created_at: string;
};

export type ParticipantAccountResolution = {
  status: ParticipantAccountConnectionStatus;
  adminUserId: string | null;
  participant: ApprovedParticipant | null;
  displayName: string | null;
  message: string;
  setupRequired?: boolean;
};

type ParticipantAccountRow = {
  participant_id: string | null;
  status: string | null;
  display_name_override: string | null;
};

const CONNECTION_MESSAGES: Record<ParticipantAccountConnectionStatus, string> = {
  approved: "관리자 승인이 완료된 계정입니다.",
  pending: "이름 연결 요청을 확인하고 있어요. 관리자 승인 후 기록을 볼 수 있습니다.",
  revoked: "계정 연결이 해제됐어요. 관리자에게 다시 승인을 요청해주세요.",
  unlinked: "관리자 승인이 필요한 계정입니다. 이름을 입력해 연결을 요청해주세요.",
  invalid: "승인된 참가자 연결을 확인할 수 없어요. 관리자에게 연결 상태를 확인해주세요.",
  setup_required: "참가자 계정 승인 기능이 아직 준비되지 않았어요. 관리자에게 문의해주세요.",
  admin_missing: "관리자 계정을 찾지 못했어요. 관리자에게 문의해주세요.",
};

function unresolved(
  status: Exclude<ParticipantAccountConnectionStatus, "approved">,
  adminUserId: string | null,
  setupRequired = false
): ParticipantAccountResolution {
  return {
    status,
    adminUserId,
    participant: null,
    displayName: null,
    message: CONNECTION_MESSAGES[status],
    ...(setupRequired ? { setupRequired: true } : {}),
  };
}

/**
 * Resolves an authenticated account to an active participant only through an
 * explicit administrator-approved binding. User-editable profile metadata and
 * runner names are intentionally never used as authorization inputs.
 */
export async function resolveParticipantAccount(
  service: SupabaseClient,
  authUserId: string
): Promise<ParticipantAccountResolution> {
  const adminUserId = await findAdminUserId(service);
  if (!adminUserId) return unresolved("admin_missing", null);

  const { data: accountData, error: accountError } = await service
    .from("participant_accounts")
    .select("participant_id, status, display_name_override")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (accountError) {
    if (isMissingTableError(accountError)) {
      return unresolved("setup_required", adminUserId, true);
    }
    throw accountError;
  }

  const account = accountData as ParticipantAccountRow | null;
  if (!account) return unresolved("unlinked", adminUserId);
  if (account.status === "revoked") return unresolved("revoked", adminUserId);
  if (account.status !== "approved") return unresolved("pending", adminUserId);
  if (!account.participant_id) return unresolved("invalid", adminUserId);

  const { data: participantData, error: participantError } = await service
    .from("participants")
    .select("id, name, active, display_order, created_at")
    .eq("id", account.participant_id)
    .eq("user_id", adminUserId)
    .eq("active", true)
    .maybeSingle();

  if (participantError) throw participantError;
  if (!participantData) return unresolved("invalid", adminUserId);

  return {
    status: "approved",
    adminUserId,
    participant: participantData as ApprovedParticipant,
    displayName: account.display_name_override?.trim() || participantData.name,
    message: CONNECTION_MESSAGES.approved,
  };
}

export function participantAccountMutationError(resolution: ParticipantAccountResolution) {
  const setupRequired = resolution.status === "setup_required";
  const unavailable = setupRequired || resolution.status === "admin_missing";

  return {
    status: unavailable ? 503 : 403,
    payload: {
      error: resolution.message,
      connection_status: resolution.status,
      ...(setupRequired
        ? {
            setup_required: true,
            setup_file: "docs/supabase-schema.sql",
          }
        : {}),
    },
  };
}
