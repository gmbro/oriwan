import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findAdminUserId } from "@/lib/admin-data";
import {
  getAutomaticFourthParticipantId,
  normalizeAutomaticFourthParticipantName,
} from "@/lib/automatic-fourth-participant";
import { AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER } from "@/lib/fourth-participant-visibility";
import { FOURTH_SEASON_KEY } from "@/lib/fourth-season-contract";
import { isMissingTableError } from "@/lib/supabase-errors";

export { FOURTH_SEASON_KEY } from "@/lib/fourth-season-contract";

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
  automaticallyEnrolled?: boolean;
  message: string;
  setupRequired?: boolean;
};

type ParticipantAccountRow = {
  participant_id: string | null;
  season_key: string | null;
  status: string | null;
  display_name_override: string | null;
};

function isUniqueViolation(error: unknown) {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error as { code?: string }).code === "23505"
  );
}

const CONNECTION_MESSAGES: Record<ParticipantAccountConnectionStatus, string> = {
  approved: "4기 개인 계정이 연결됐어요.",
  pending: "개인 계정을 연결하고 있어요. 잠시 후 다시 확인해주세요.",
  revoked: "계정 연결이 중지됐어요. 관리자에게 문의해주세요.",
  unlinked: "개인 계정 연결을 준비하고 있어요.",
  invalid: "개인 계정 연결을 확인할 수 없어요. 관리자에게 문의해주세요.",
  setup_required: "개인 계정 기능이 아직 준비되지 않았어요. 관리자에게 문의해주세요.",
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

/** Resolves the server-owned participant bound to this authenticated account. */
export async function resolveParticipantAccount(
  service: SupabaseClient,
  authUserId: string
): Promise<ParticipantAccountResolution> {
  const adminUserId = await findAdminUserId(service);
  if (!adminUserId) return unresolved("admin_missing", null);

  const { data: accountData, error: accountError } = await service
    .from("participant_accounts")
    .select("participant_id, season_key, status, display_name_override")
    .eq("auth_user_id", authUserId)
    .eq("season_key", FOURTH_SEASON_KEY)
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
    .eq("season_key", FOURTH_SEASON_KEY)
    .eq("active", true)
    .maybeSingle();

  if (participantError) throw participantError;
  if (!participantData) return unresolved("invalid", adminUserId);

  return {
    status: "approved",
    adminUserId,
    participant: participantData as ApprovedParticipant,
    displayName: account.display_name_override?.trim() || participantData.name,
    automaticallyEnrolled: participantData.display_order === AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
    message: CONNECTION_MESSAGES.approved,
  };
}

/**
 * Gives a verified Kakao account an isolated personal participant immediately.
 * The generated participant is hidden from the public crew list until an
 * operator assigns it a normal display order. Revoked accounts stay revoked.
 */
export async function ensureParticipantAccount(
  service: SupabaseClient,
  authUserId: string,
  kakaoDisplayName: string | null,
): Promise<ParticipantAccountResolution> {
  const current = await resolveParticipantAccount(service, authUserId);
  if (
    current.status === "approved"
    || current.status === "revoked"
    || current.status === "invalid"
    || current.status === "setup_required"
    || current.status === "admin_missing"
  ) {
    return current;
  }

  const adminUserId = current.adminUserId;
  if (!adminUserId) return current;

  const { data: existingAccount, error: existingAccountError } = await service
    .from("participant_accounts")
    .select("participant_id, status, display_name_override")
    .eq("auth_user_id", authUserId)
    .eq("season_key", FOURTH_SEASON_KEY)
    .maybeSingle();
  if (existingAccountError) throw existingAccountError;
  if (existingAccount?.status === "revoked") {
    return unresolved("revoked", adminUserId);
  }

  const displayName = normalizeAutomaticFourthParticipantName(
    existingAccount?.display_name_override || kakaoDisplayName,
  );
  let participantId = existingAccount?.participant_id || null;

  if (participantId) {
    const { data: linkedParticipant, error: linkedParticipantError } = await service
      .from("participants")
      .select("id")
      .eq("id", participantId)
      .eq("user_id", adminUserId)
      .eq("season_key", FOURTH_SEASON_KEY)
      .eq("active", true)
      .maybeSingle();
    if (linkedParticipantError) throw linkedParticipantError;
    if (!linkedParticipant) participantId = null;
  }

  if (!participantId) {
    participantId = getAutomaticFourthParticipantId(authUserId, FOURTH_SEASON_KEY);
    const { error: participantError } = await service
      .from("participants")
      .upsert({
        id: participantId,
        user_id: adminUserId,
        season_key: FOURTH_SEASON_KEY,
        name: displayName,
        active: true,
        display_order: AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
      }, { onConflict: "id", ignoreDuplicates: true });
    if (participantError) throw participantError;
  }

  const now = new Date().toISOString();
  const accountPayload = {
    participant_id: participantId,
    auth_user_id: authUserId,
    status: "approved",
    approved_at: now,
    approved_by: adminUserId,
    display_name_override: displayName,
    season_key: FOURTH_SEASON_KEY,
    updated_at: now,
  };

  if (existingAccount) {
    // Never overwrite an operator revoke that races with this login request.
    // PostgREST applies the status predicate in the same UPDATE statement.
    const { error: accountError } = await service
      .from("participant_accounts")
      .update(accountPayload)
      .eq("auth_user_id", authUserId)
      .eq("season_key", FOURTH_SEASON_KEY)
      .neq("status", "revoked");
    if (accountError) throw accountError;
  } else {
    // A concurrent first login can win the unique key. In that case, resolve the
    // winning row instead of using an upsert that could revive a revoked account.
    const { error: accountError } = await service
      .from("participant_accounts")
      .insert(accountPayload);
    if (accountError && !isUniqueViolation(accountError)) throw accountError;
  }

  return resolveParticipantAccount(service, authUserId);
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
