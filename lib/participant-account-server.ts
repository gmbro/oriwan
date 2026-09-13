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
  pending: "운영자 승인을 기다리고 있어요. 승인 후 멤버로 참여할 수 있어요.",
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
  if (current.status === "approved") return promoteApprovedLegacyHiddenParticipant(service, authUserId, current);
  if (current.status !== "unlinked" || !current.adminUserId) return current;
  const participantId = getAutomaticFourthParticipantId(authUserId, FOURTH_SEASON_KEY);
  const displayName = normalizeAutomaticFourthParticipantName(kakaoDisplayName);
  // A pending draft stays outside the public crew and all official denominators.
  const {error: participantError}=await service.from("participants").upsert({
    id:participantId,user_id:current.adminUserId,season_key:FOURTH_SEASON_KEY,
    name:displayName,active:true,display_order:LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
  },{onConflict:"id"}).select("id").single();
  if(participantError)throw participantError;
  const {error}=await service.from("participant_accounts").insert({
    participant_id:participantId,auth_user_id:authUserId,status:"pending",
    approved_at:null,approved_by:null,display_name_override:displayName,
    season_key:FOURTH_SEASON_KEY,updated_at:new Date().toISOString(),
  });
  // Unique insert: repeated logins must never overwrite approval or revocation.
  if(error && !isUniqueViolation(error))throw error;
  return promoteApprovedLegacyHiddenParticipant(service,authUserId,await resolveParticipantAccount(service,authUserId));
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
