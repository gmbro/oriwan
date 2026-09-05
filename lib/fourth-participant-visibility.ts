export const AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER = -1;

export const PUBLIC_FOURTH_PARTICIPANT_ORDER_FILTER =
  `display_order.is.null,display_order.gt.${AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER}`;

export function isPublicFourthParticipantOrder(displayOrder: number | null | undefined) {
  return displayOrder !== AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER;
}
