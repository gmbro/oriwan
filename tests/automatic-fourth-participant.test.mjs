import assert from "node:assert/strict";
import test from "node:test";

import {
  getAutomaticFourthParticipantId,
  isAutomaticFourthParticipantId,
  normalizeAutomaticFourthParticipantName,
} from "../lib/automatic-fourth-participant.ts";
import {
  AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
  isAutomaticallyEnrolledFourthParticipantOrder,
  isPublicFourthParticipantOrder,
  LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
  needsAutomaticFourthParticipantOrderUpgrade,
  PUBLIC_FOURTH_PARTICIPANT_ORDER_FILTER,
  shouldPromoteApprovedLegacyFourthParticipant,
} from "../lib/fourth-participant-visibility.ts";

test("카카오 계정별 자동 참가자 ID는 안정적이고 서로 격리된다", () => {
  const first = getAutomaticFourthParticipantId("11111111-1111-4111-8111-111111111111", "4th");
  const repeated = getAutomaticFourthParticipantId("11111111-1111-4111-8111-111111111111", "4th");
  const anotherUser = getAutomaticFourthParticipantId("22222222-2222-4222-8222-222222222222", "4th");
  const anotherSeason = getAutomaticFourthParticipantId("11111111-1111-4111-8111-111111111111", "5th");

  assert.equal(first, repeated);
  assert.notEqual(first, anotherUser);
  assert.notEqual(first, anotherSeason);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(isAutomaticFourthParticipantId(first, "11111111-1111-4111-8111-111111111111", "4th"), true);
  assert.equal(isAutomaticFourthParticipantId(anotherUser, "11111111-1111-4111-8111-111111111111", "4th"), false);
});

test("자동 참가자 이름은 화면용 텍스트로 정리하고 안전한 기본값을 사용한다", () => {
  assert.equal(normalizeAutomaticFourthParticipantName("  한강\u200b   러너  "), "한강 러너");
  assert.equal(normalizeAutomaticFourthParticipantName("가"), "카카오 러너");
  assert.equal(normalizeAutomaticFourthParticipantName(null), "카카오 러너");
  assert.equal(normalizeAutomaticFourthParticipantName("가".repeat(60)).length, 40);
});

test("자동 참가자는 즉시 공개되고 운영자가 정렬하기 전까지 관리 멤버 뒤에 놓인다", () => {
  assert.equal(AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER, 10_000);
  assert.equal(isPublicFourthParticipantOrder(AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER), true);
  assert.equal(isPublicFourthParticipantOrder(0), true);
  assert.equal(isPublicFourthParticipantOrder(null), true);
  assert.equal(PUBLIC_FOURTH_PARTICIPANT_ORDER_FILTER, "display_order.is.null,display_order.gt.-1");
});

test("과거 비공개 자동 참가자는 승인된 로그인에서만 새 공개 순서로 승격한다", () => {
  assert.equal(LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER, -1);
  assert.equal(isPublicFourthParticipantOrder(-1), false);
  assert.equal(isAutomaticallyEnrolledFourthParticipantOrder(-1), true);
  assert.equal(isAutomaticallyEnrolledFourthParticipantOrder(10_000), true);
  assert.equal(isAutomaticallyEnrolledFourthParticipantOrder(0), false);
  assert.equal(needsAutomaticFourthParticipantOrderUpgrade(-1), true);
  assert.equal(needsAutomaticFourthParticipantOrderUpgrade(10_000), false);
  assert.equal(isPublicFourthParticipantOrder(-2), false);
});

test("승인된 4기 연결은 참가자 ID 생성 방식과 무관하게 legacy 비공개 순서에서 승격한다", () => {
  const verifiedConnection = {
    connectionStatus: "approved",
    participantActive: true,
    participantUserId: "admin-user",
    adminUserId: "admin-user",
    participantSeasonKey: "4th",
    expectedSeasonKey: "4th",
    displayOrder: LEGACY_HIDDEN_AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
  };

  assert.equal(shouldPromoteApprovedLegacyFourthParticipant(verifiedConnection), true);
  assert.equal(shouldPromoteApprovedLegacyFourthParticipant({ ...verifiedConnection, connectionStatus: "revoked" }), false);
  assert.equal(shouldPromoteApprovedLegacyFourthParticipant({ ...verifiedConnection, participantActive: false }), false);
  assert.equal(shouldPromoteApprovedLegacyFourthParticipant({ ...verifiedConnection, participantUserId: "another-admin" }), false);
  assert.equal(shouldPromoteApprovedLegacyFourthParticipant({ ...verifiedConnection, participantSeasonKey: "3th" }), false);
  assert.equal(shouldPromoteApprovedLegacyFourthParticipant({ ...verifiedConnection, displayOrder: 0 }), false);
});
