import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CORRECTIVE_INQUIRY_LENGTH,
  MAX_CORRECTIVE_INQUIRY_PAIN_AREA_LENGTH,
  parseCorrectiveInquiryInput,
} from "../lib/corrective-exercise-contract.ts";

test("간단 문의는 본문만 검증하고 정규화한다", () => {
  const parsed = parseCorrectiveInquiryInput({
    inquiry_message: "  달릴 때\u200b 무릎이 불편해요.\r\n자세가 궁금합니다.  ",
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.inquiry_message, "달릴 때 무릎이 불편해요.\n자세가 궁금합니다.");
});

test("본문이 없거나 너무 짧거나 길면 문의를 거부한다", () => {
  for (const input of [
    null,
    {},
    { inquiry_message: "짧음" },
    { inquiry_message: "가".repeat(MAX_CORRECTIVE_INQUIRY_LENGTH + 1) },
    { pain_context: "기존 문진 필드만으로는 새 문의를 만들 수 없어요." },
  ]) {
    assert.equal(parseCorrectiveInquiryInput(input).ok, false);
  }
});

test("message 호환 필드도 같은 규칙으로 처리한다", () => {
  const parsed = parseCorrectiveInquiryInput({ message: "러닝 자세가 궁금해요." });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.inquiry_message, "러닝 자세가 궁금해요.");
});

test("간단한 네 칸 문의는 라벨을 붙여 하나의 보관 메시지로 만든다", () => {
  const parsed = parseCorrectiveInquiryInput({
    pain_area: "  오른쪽 무릎  ",
    pain_onset: "지난주 러닝 뒤부터",
    aggravating_situation: "계단을 내려갈 때",
    additional_question: "스트레칭 방법이 궁금해요.",
  });

  assert.equal(parsed.ok, true);
  assert.equal(
    parsed.value.inquiry_message,
    "통증 부위: 오른쪽 무릎\n언제부터 불편했나요: 지난주 러닝 뒤부터\n더 불편한 움직임·상황: 계단을 내려갈 때\n그 밖에 문의: 스트레칭 방법이 궁금해요.",
  );
});

test("구조화된 문의는 핵심 세 항목과 각 항목의 길이를 검증한다", () => {
  for (const input of [
    {
      pain_area: "",
      pain_onset: "지난주부터",
      aggravating_situation: "계단에서",
    },
    {
      pain_area: "무릎",
      pain_onset: "",
      aggravating_situation: "계단에서",
    },
    {
      pain_area: "무릎",
      pain_onset: "지난주부터",
      aggravating_situation: "",
    },
    {
      pain_area: "가".repeat(MAX_CORRECTIVE_INQUIRY_PAIN_AREA_LENGTH + 1),
      pain_onset: "지난주부터",
      aggravating_situation: "계단에서",
    },
  ]) {
    assert.equal(parseCorrectiveInquiryInput(input).ok, false);
  }
});
