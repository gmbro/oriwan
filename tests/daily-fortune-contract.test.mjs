import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveAnonymousFortuneProfile,
  parseDailyFortuneInput,
} from "../lib/daily-fortune-contract.ts";

const validInput = {
  name: "테스트 사용자",
  birth_date: "1990-04-12",
  birth_time: "08:35",
  residence: "seoul",
  consent: true,
};

test("오늘의 운세 입력은 이름·생년월일·시간·생활 권역·동의를 모두 검증한다", () => {
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
    { ...validInput, consent: false },
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
