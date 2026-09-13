import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findAdminUserId } from "@/lib/admin-data";
import {
  getAutomaticFourthParticipantId,
  isAutomaticFourthParticipantId,
  normalizeAutomaticFourthParticipantName,
} from "@/lib/automatic-fourth-participant";
import {
  AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
  LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
  shouldPromoteApprovedLegacyFourthParticipant,
} from "@/lib/fourth-participant-visibility";
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
  user_id: string;
  season_key: string;
};

export type ParticipantAccountResolution = {
  status: ParticipantAccountConnectionStatus;
  adminUserId: string | null;
  participant: ApprovedParticipant | null;
  displayName: string | null;
  automaticallyEnrolled?: boolean;
  /** True only for the request that won the first automatic account-link insert. */
  newlyEnrolled?: boolean;
  /** True when this request added a member to, or upgraded one for, the public dashboard. */
  dashboardMemberChanged?: boolean;
  message: string;
  setupRequired?: boolean;
};

type ParticipantAccountRow = {
  participant_id: string | null;
  season_key: string | null;
  status: string | null;
  display_name_override: string | null;
  participant: ParticipantAccountParticipantRow | ParticipantAccountParticipantRow[] | null;
};

type ParticipantAccountParticipantRow = ApprovedParticipant;

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

async function promoteApprovedLegacyHiddenParticipant(
  service: SupabaseClient,
  authUserId: string,
  resolution: ParticipantAccountResolution,
): Promise<ParticipantAccountResolution> {
  const participant = resolution.participant;
  const adminUserId = resolution.adminUserId;

  if (
    !participant
    || !adminUserId
    || !shouldPromoteApprovedLegacyFourthParticipant({
      connectionStatus: resolution.status,
      participantActive: participant.active,
      participantUserId: participant.user_id,
      adminUserId,
      participantSeasonKey: participant.season_key,
      expectedSeasonKey: FOURTH_SEASON_KEY,
      displayOrder: participant.display_order,
    })
  ) {
    return resolution;
  }

  const originalParticipantId = participant.id;

  const { data: upgradedParticipant, error: upgradeError } = await service
    .from("participants")
    .update({ display_order: AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER })
    .eq("id", originalParticipantId)
    .eq("user_id", adminUserId)
    .eq("season_key", FOURTH_SEASON_KEY)
    .eq("active", true)
    .eq("display_order", LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER)
    .select("id, name, active, display_order, created_at, user_id, season_key")
    .maybeSingle();
  if (upgradeError) throw upgradeError;
  if (!upgradedParticipant) return resolveParticipantAccount(service, authUserId);

  // The account status can change while the participant row is being promoted.
  // Re-read it before reporting success, and roll the originally linked row
  // back to private if an operator revoked or reassigned it in that window.
  const confirmedResolution = await resolveParticipantAccount(service, authUserId);
  if (
    confirmedResolution.status !== "approved"
    || confirmedResolution.participant?.id !== originalParticipantId
  ) {
    const { error: rollbackError } = await service
      .from("participants")
      .update({ display_order: LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER })
      .eq("id", originalParticipantId)
      .eq("user_id", adminUserId)
      .eq("season_key", FOURTH_SEASON_KEY)
      .eq("active", true)
      .eq("display_order", AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER);
    if (rollbackError) throw rollbackError;
    return { ...confirmedResolution, dashboardMemberChanged: true };
  }

  return {
    ...confirmedResolution,
    participant: upgradedParticipant as ApprovedParticipant,
    dashboardMemberChanged: true,
  };
}

/** Resolves the server-owned participant bound to this authenticated account. */
export async function resolveParticipantAccount(
  service: SupabaseClient,
  authUserId: string
): Promise<ParticipantAccountResolution> {
  const accountRequest = service
    .from("participant_accounts")
    .select(`
      participant_id,
      season_key,
      status,
      display_name_override,
      participant:participants!participant_accounts_participant_id_fkey(
        id,
        name,
        active,
        display_order,
        created_at,
        user_id,
        season_key
      )
    `)
    .eq("auth_user_id", authUserId)
    .eq("season_key", FOURTH_SEASON_KEY)
    .maybeSingle();
  const [adminUserId, { data: accountData, error: accountError }] = await Promise.all([
    findAdminUserId(service),
    accountRequest,
  ]);

  if (!adminUserId) return unresolved("admin_missing", null);
  if (accountError) {
    if (isMissingTableError(accountError)) {
      return unresolved("setup_required", adminUserId, true);
    }
    throw accountError;
  }

  const account = accountData as ParticipantAccountRow | null;
  const participantData = account
    ? Array.isArray(account.participant)
      ? account.participant[0] || null
      : account.participant
    : null;

  // An approved FK-linked account already carries the server-owned tenant ID.
  // Validate the complete relationship before returning so the normal path no
  // longer needs a preceding Auth Admin lookup.
  if (
    account?.status === "approved"
    && account.participant_id
    && participantData
    && participantData.id === account.participant_id
    && participantData.user_id === adminUserId
    && participantData.season_key === FOURTH_SEASON_KEY
    && participantData.active
  ) {
    return {
      status: "approved",
      adminUserId,
      participant: participantData,
      displayName: account.display_name_override?.trim() || participantData.name,
      automaticallyEnrolled: isAutomaticFourthParticipantId(participantData.id, authUserId, FOURTH_SEASON_KEY),
      message: CONNECTION_MESSAGES.approved,
    };
  }

  if (!account) return unresolved("unlinked", adminUserId);
  if (account.status === "revoked") return unresolved("revoked", adminUserId);
  if (account.status !== "approved") return unresolved("pending", adminUserId);
  if (!account.participant_id) return unresolved("invalid", adminUserId);

  if (
    !participantData
    || participantData.id !== account.participant_id
    || participantData.user_id !== adminUserId
    || participantData.season_key !== FOURTH_SEASON_KEY
    || !participantData.active
  ) return unresolved("invalid", adminUserId);

  return {
    status: "approved",
    adminUserId,
    participant: participantData,
    displayName: account.display_name_override?.trim() || participantData.name,
    automaticallyEnrolled: isAutomaticFourthParticipantId(participantData.id, authUserId, FOURTH_SEASON_KEY),
    message: CONNECTION_MESSAGES.approved,
  };
}

/**
 * Gives a verified Kakao account an isolated public participant immediately.
 * Automatic members are placed after the operator-curated crew until an
 * operator assigns a normal display order. Revoked accounts stay revoked.
 */
export async function ensureParticipantAccount(
  service: SupabaseClient,
  authUserId: string,
  kakaoDisplayName: string | null,
): Promise<ParticipantAccountResolution> {
  const current = await resolveParticipantAccount(service, authUserId);
  if (current.status === "approved") {
    return promoteApprovedLegacyHiddenParticipant(service, authUserId, current);
  }

  if (
    current.status === "revoked"
    || current.status === "invalid"
    || current.status === "setup_required"
    || current.status === "admin_missing"
  ) {
    return current;
  }

  const adminUserId = current.adminUserId;
  if (!adminUserId) return current;

  // resolveParticipantAccount already proved that an unlinked account has no
  // row. Only pending accounts need their draft linkage loaded for enrollment.
  const { data: existingAccount, error: existingAccountError } = current.status === "pending"
    ? await service
      .from("participant_accounts")
      .select("participant_id, status, display_name_override")
      .eq("auth_user_id", authUserId)
      .eq("season_key", FOURTH_SEASON_KEY)
      .maybeSingle()
    : { data: null, error: null };
  if (existingAccountError) throw existingAccountError;
  if (existingAccount?.status === "revoked") {
    return unresolved("revoked", adminUserId);
  }

  const displayName = normalizeAutomaticFourthParticipantName(
    existingAccount?.display_name_override || kakaoDisplayName,
  );
  let participantId = existingAccount?.participant_id || null;
  let automaticParticipantId: string | null = null;
  let newlyEnrolled = false;

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
    automaticParticipantId = participantId;
    const { data: enrolledParticipant, error: participantError } = await service
      .from("participants")
      .upsert({
        id: participantId,
        user_id: adminUserId,
        season_key: FOURTH_SEASON_KEY,
        name: displayName,
        active: true,
        // Keep the row private until its participant_accounts row is confirmed
        // approved. A failed or revoked account write must never expose an orphan.
        display_order: LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
      }, { onConflict: "id" })
      .select("id")
      .single();
    if (participantError) throw participantError;
    if (!enrolledParticipant) throw new Error("automatic_participant_not_created");
    // The deterministic id makes simultaneous first-logins converge on one
    // hidden row and recovers an inactive orphan from an interrupted request.
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
    const { data: updatedAccount, error: accountError } = await service
      .from("participant_accounts")
      .update(accountPayload)
      .eq("auth_user_id", authUserId)
      .eq("season_key", FOURTH_SEASON_KEY)
      .neq("status", "revoked")
      .select("auth_user_id")
      .maybeSingle();
    if (accountError) throw accountError;
    if (!updatedAccount) {
      if (automaticParticipantId) {
        const { error: cleanupError } = await service
          .from("participants")
          .update({ active: false })
          .eq("id", automaticParticipantId)
          .eq("user_id", adminUserId)
          .eq("season_key", FOURTH_SEASON_KEY)
          .eq("display_order", LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER);
        if (cleanupError) throw cleanupError;
      }
      return resolveParticipantAccount(service, authUserId);
    }
  } else {
    // A concurrent first login can win the unique key. In that case, resolve the
    // winning row instead of using an upsert that could revive a revoked account.
    const { error: accountError } = await service
      .from("participant_accounts")
      .insert(accountPayload);
    if (accountError && !isUniqueViolation(accountError)) throw accountError;

    // Only the unique participant_accounts INSERT winner may import Kakao's
    // image. Existing and legacy-recovered account rows take the update/approved
    // paths above and therefore never receive this flag.
    newlyEnrolled = !accountError && Boolean(automaticParticipantId);

    if (accountError && automaticParticipantId) {
      const winningResolution = await resolveParticipantAccount(service, authUserId);
      if (winningResolution.participant?.id !== automaticParticipantId) {
        // A concurrently-created account row won with a different participant
        // (or was revoked). Do not leak the losing deterministic draft into the
        // public crew list.
        const { error: cleanupError } = await service
          .from("participants")
          .update({ active: false })
          .eq("id", automaticParticipantId)
          .eq("user_id", adminUserId)
          .eq("season_key", FOURTH_SEASON_KEY);
        if (cleanupError) throw cleanupError;
      }
      return promoteApprovedLegacyHiddenParticipant(service, authUserId, winningResolution);
    }
  }

  const resolved = await resolveParticipantAccount(service, authUserId);
  const promoted = await promoteApprovedLegacyHiddenParticipant(service, authUserId, resolved);
  return newlyEnrolled && promoted.status === "approved"
    ? { ...promoted, newlyEnrolled: true }
    : promoted;
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
