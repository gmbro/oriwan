/**
 * Kakao-created members are public immediately, but remain after the
 * operator-curated crew when no explicit order has been assigned yet.
 */
export const AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER = 10_000;

/** display_order used by releases that kept Kakao-created members private. */
export const LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER = -1;

export const PUBLIC_FOURTH_PARTICIPANT_ORDER_FILTER =
  `display_order.is.null,display_order.gt.${LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER}`;

export function isPublicFourthParticipantOrder(displayOrder: number | null | undefined) {
  return displayOrder == null || displayOrder > LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER;
}

export function isAutomaticallyEnrolledFourthParticipantOrder(displayOrder: number | null | undefined) {
  return displayOrder === AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER
    || displayOrder === LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER;
}

export function needsAutomaticFourthParticipantOrderUpgrade(displayOrder: number | null | undefined) {
  return displayOrder === LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER;
}

/**
 * Legacy releases used -1 for every Kakao-created draft, including rows whose
 * account link was later approved. Promotion is based on the verified account
 * relationship, not on how the participant id happened to be generated.
 */
export function shouldPromoteApprovedLegacyFourthParticipant({
  connectionStatus,
  participantActive,
  participantUserId,
  adminUserId,
  participantSeasonKey,
  expectedSeasonKey,
  displayOrder,
}: {
  connectionStatus: string;
  participantActive: boolean;
  participantUserId: string;
  adminUserId: string;
  participantSeasonKey: string;
  expectedSeasonKey: string;
  displayOrder: number | null | undefined;
}) {
  return connectionStatus === "approved"
    && participantActive
    && participantUserId === adminUserId
    && participantSeasonKey === expectedSeasonKey
    && needsAutomaticFourthParticipantOrderUpgrade(displayOrder);
}
