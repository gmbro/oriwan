import assert from "node:assert/strict";
import test from "node:test";

import {
  getAutomaticFourthParticipantId,
  normalizeAutomaticFourthParticipantName,
} from "../lib/automatic-fourth-participant.ts";
import {
  AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER,
  isPublicFourthParticipantOrder,
  PUBLIC_FOURTH_PARTICIPANT_ORDER_FILTER,
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
});

test("자동 참가자 이름은 화면용 텍스트로 정리하고 안전한 기본값을 사용한다", () => {
  assert.equal(normalizeAutomaticFourthParticipantName("  한강\u200b   러너  "), "한강 러너");
  assert.equal(normalizeAutomaticFourthParticipantName("가"), "카카오 러너");
  assert.equal(normalizeAutomaticFourthParticipantName(null), "카카오 러너");
  assert.equal(normalizeAutomaticFourthParticipantName("가".repeat(60)).length, 40);
});

test("자동 참가자는 운영자가 공개 순서를 정하기 전까지 비공개 순서를 사용한다", () => {
  assert.equal(AUTO_ENROLLED_FOURTH_PARTICIPANT_ORDER, -1);
  assert.equal(isPublicFourthParticipantOrder(-1), false);
  assert.equal(isPublicFourthParticipantOrder(0), true);
  assert.equal(isPublicFourthParticipantOrder(null), true);
  assert.equal(PUBLIC_FOURTH_PARTICIPANT_ORDER_FILTER, "display_order.is.null,display_order.gt.-1");
});
