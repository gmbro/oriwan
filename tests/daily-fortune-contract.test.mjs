import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveAnonymousFortuneProfile,
  parseDailyFortuneInput,
  parseDailyFortuneResult,
  SAFE_DAILY_FORTUNE_FALLBACK,
} from "../lib/daily-fortune-contract.ts";

const validInput = {
  name: "테스트 사용자",
  birth_date: "1990-04-12",
  birth_time: "08:35",
  residence: "seoul",
};

test("오늘의 운세 입력은 이름·생년월일·시간·생활 권역과 성인 여부를 검증한다", () => {
  const result = parseDailyFortuneInput(validInput, "2026-09-06");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, validInput);

  for (const invalid of [
    { ...validInput, name: "가" },
    { ...validInput, birth_date: "2026-02-30" },
    { ...validInput, birth_date: "2027-01-01" },
    { ...validInput, birth_date: "2010-01-01" },
    { ...validInput, birth_time: "24:00" },
    { ...validInput, residence: "서울 강남구" },
  ]) {
    assert.equal(parseDailyFortuneInput(invalid, "2026-09-06").ok, false);
  }
});

test("외부 운세 요청용 파생 정보에는 입력 원문이 남지 않는다", () => {
  const parsed = parseDailyFortuneInput(validInput, "2026-09-06");
  assert.equal(parsed.ok, true);
  const derived = deriveAnonymousFortuneProfile(parsed.value);
  const serialized = JSON.stringify(derived);

  assert.equal(serialized.includes(validInput.name), false);
  assert.equal(serialized.includes(validInput.birth_date), false);
  assert.equal(serialized.includes(validInput.birth_time), false);
  assert.deepEqual(Object.keys(derived).sort(), [
    "birth_time_band",
    "chinese_zodiac",
    "name_energy",
    "residence_region",
    "western_zodiac",
  ]);
});

test("이름 제어문자는 제거하고 공백은 한 칸으로 정규화한다", () => {
  const result = parseDailyFortuneInput({
    ...validInput,
    name: "  홍\u200b   길동  ",
  }, "2026-09-06");

  assert.equal(result.ok, true);
  assert.equal(result.value.name, "홍 길동");
});

test("결과에서 입력값과 파생 조건을 드러내는 표현을 차단한다", () => {
  const parsed = parseDailyFortuneInput(validInput, "2026-09-06");
  assert.equal(parsed.ok, true);
  const profile = deriveAnonymousFortuneProfile(parsed.value);
  const safeResult = {
    title: "작은 정리가 흐름을 바꾸는 날",
    message: "지금 가장 중요한 한 가지에 차분히 집중해보세요.",
    keyword: "집중",
    action: "할 일을 하나 적고 바로 시작해보세요.",
    relationship: "상대의 말을 끝까지 들으면 마음을 더 정확히 이해할 수 있어요.",
    work: "첫 단계를 작게 나누면 부담을 줄이고 꾸준히 이어갈 수 있어요.",
  };

  assert.deepEqual(parseDailyFortuneResult(safeResult, profile), safeResult);
  for (const restrictedText of [
    profile.western_zodiac,
    profile.chinese_zodiac,
    profile.birth_time_band,
    profile.residence_region,
    "입력 정보",
    "파생 조건",
    "출생 시간대",
    "거주 지역",
    "이름 지표",
    "사자자리",
    "물병 자리",
    "토끼띠",
    "용 띠",
    "수도권",
    "제주에서",
  ]) {
    assert.equal(parseDailyFortuneResult({
      ...safeResult,
      message: `${safeResult.message} ${restrictedText}`,
    }, profile), null);
  }
});

test("안전 대체 운세는 노출 금지 표현 없이 유효하다", () => {
  const parsed = parseDailyFortuneInput(validInput, "2026-09-06");
  assert.equal(parsed.ok, true);
  const profile = deriveAnonymousFortuneProfile(parsed.value);
  assert.deepEqual(
    parseDailyFortuneResult(SAFE_DAILY_FORTUNE_FALLBACK, profile),
    SAFE_DAILY_FORTUNE_FALLBACK,
  );
});
