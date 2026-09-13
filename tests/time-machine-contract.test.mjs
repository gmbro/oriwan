import assert from "node:assert/strict";
import test from "node:test";

import {
  getTimeMachineTiming,
  parseTimeMachineGoalInput,
  parseTimeMachineResetInput,
  TIME_MACHINE_UNLOCK_AT,
} from "../lib/time-machine-contract.ts";

const validGoal = {
  goal_title: "10km를 편하게 완주하기",
  goal_detail: "주 3회 달리고 매주 기록을 남긴다.",
  commitment: "힘든 날에도 10분은 움직인다.",
};

test("목표 타임머신 입력은 제어문자를 제거하고 길이를 검증한다", () => {
  const parsed = parseTimeMachineGoalInput({
    ...validGoal,
    goal_title: "  10km\u200b를 편하게 완주하기  ",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.goal_title, validGoal.goal_title);

  assert.equal(parseTimeMachineGoalInput({ ...validGoal, goal_detail: "가".repeat(501) }).ok, false);
  assert.equal(parseTimeMachineGoalInput({ ...validGoal, commitment: "가".repeat(301) }).ok, false);
});

test("세부 목표와 다짐은 선택 입력이며 누락되거나 비어 있으면 빈 문자열로 정규화한다", () => {
  const omitted = parseTimeMachineGoalInput({ goal_title: validGoal.goal_title });
  assert.equal(omitted.ok, true);
  assert.deepEqual(omitted.value, {
    goal_title: validGoal.goal_title,
    goal_detail: "",
    commitment: "",
  });

  const blank = parseTimeMachineGoalInput({
    goal_title: validGoal.goal_title,
    goal_detail: " \u200b ",
    commitment: "\r\n ",
  });
  assert.equal(blank.ok, true);
  assert.equal(blank.value.goal_detail, "");
  assert.equal(blank.value.commitment, "");
});

test("기존 세부 목표와 다짐은 그대로 호환된다", () => {
  const parsed = parseTimeMachineGoalInput(validGoal);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.goal_detail, validGoal.goal_detail);
  assert.equal(parsed.value.commitment, validGoal.commitment);
});

test("타임머신은 2027-01-01 00:00 KST에만 서버 기준으로 열린다", () => {
  const justBefore = getTimeMachineTiming(new Date("2026-12-31T14:59:59.999Z"));
  const atUnlock = getTimeMachineTiming(new Date("2026-12-31T15:00:00.000Z"));

  assert.equal(justBefore.unlocked, false);
  assert.equal(atUnlock.unlocked, true);
  assert.equal(atUnlock.unlock_at, TIME_MACHINE_UNLOCK_AT);
});

test("타임머신 흔들림 진행도는 100일 구간 밖에서 안전하게 제한된다", () => {
  assert.equal(getTimeMachineTiming(new Date("2026-09-22T14:59:59Z")).progress, 0);
  assert.equal(getTimeMachineTiming(new Date("2027-01-01T15:00:00Z")).progress, 1);
  assert.equal(getTimeMachineTiming(new Date("2026-11-11T15:00:00Z")).progress, 0.5);
});

test("관리자 재설정은 정상 UUID 목표만 받는다", () => {
  const goalId = "4a6d343b-548e-4ac8-87e6-44c2f9ada5bb";
  assert.deepEqual(parseTimeMachineResetInput({ goal_id: goalId }), {
    ok: true,
    value: { goal_id: goalId },
  });

  for (const input of [null, {}, { goal_id: "" }, { goal_id: "not-a-goal" }, { goal_id: 12 }]) {
    assert.equal(parseTimeMachineResetInput(input).ok, false);
  }
});
