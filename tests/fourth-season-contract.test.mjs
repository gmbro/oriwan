import assert from "node:assert/strict";
import test from "node:test";

import {
  FOURTH_PERSONAL_RECORD_START_DATE,
  FOURTH_SEASON_DAYS,
  FOURTH_SEASON_END_DATE,
  FOURTH_SEASON_START_DATE,
  clampToFourthPersonalRecordWindow,
  clampToFourthSeasonWindow,
  isFourthOfficialCertificationDate,
  isWithinFourthPersonalRecordWindow,
  isWithinFourthSeasonWindow,
} from "../lib/fourth-season-contract.ts";

test("4기 날짜 계약은 2026년 경계를 단일 기준으로 유지한다", () => {
  assert.equal(FOURTH_PERSONAL_RECORD_START_DATE, "2026-08-13");
  assert.equal(FOURTH_SEASON_START_DATE, "2026-09-23");
  assert.equal(FOURTH_SEASON_END_DATE, "2026-12-31");
  assert.equal(FOURTH_SEASON_DAYS, 100);

  const inclusiveDays = (
    Date.parse(`${FOURTH_SEASON_END_DATE}T00:00:00Z`)
    - Date.parse(`${FOURTH_SEASON_START_DATE}T00:00:00Z`)
  ) / 86_400_000 + 1;

  assert.equal(inclusiveDays, FOURTH_SEASON_DAYS);
});

test("개인 기록은 8월 13일부터 시즌 종료일까지 양 끝을 포함한다", () => {
  const cases = [
    ["2026-08-12", false],
    ["2026-08-13", true],
    ["2026-09-22", true],
    ["2026-09-23", true],
    ["2026-12-31", true],
    ["2027-01-01", false],
  ];

  for (const [date, expected] of cases) {
    assert.equal(isWithinFourthPersonalRecordWindow(date), expected, date);
  }
});

test("공식 인증은 9월 23일부터 시즌 종료일까지 양 끝을 포함한다", () => {
  const cases = [
    ["2026-08-13", false],
    ["2026-09-22", false],
    ["2026-09-23", true],
    ["2026-12-31", true],
    ["2027-01-01", false],
  ];

  for (const [date, expected] of cases) {
    assert.equal(isWithinFourthSeasonWindow(date), expected, date);
    assert.equal(isFourthOfficialCertificationDate(date), expected, date);
  }
});

test("날짜 범위 함수는 형식이 다르거나 실제 달력에 없는 날짜를 거부한다", () => {
  const invalidValues = [
    null,
    undefined,
    "",
    "2026/09/23",
    "2026-9-23",
    "2026-09-23T00:00:00Z",
    "2026-09-31",
    "2026-02-29",
  ];

  for (const value of invalidValues) {
    assert.equal(isWithinFourthPersonalRecordWindow(value), false, String(value));
    assert.equal(isWithinFourthSeasonWindow(value), false, String(value));
  }
});

test("공식 및 개인 기록 clamp는 각 시작일과 공통 종료일을 사용한다", () => {
  assert.equal(clampToFourthSeasonWindow("2026-09-22"), "2026-09-23");
  assert.equal(clampToFourthSeasonWindow("2026-09-23"), "2026-09-23");
  assert.equal(clampToFourthSeasonWindow("2026-10-16"), "2026-10-16");
  assert.equal(clampToFourthSeasonWindow("2026-12-31"), "2026-12-31");
  assert.equal(clampToFourthSeasonWindow("2027-01-01"), "2026-12-31");

  assert.equal(clampToFourthPersonalRecordWindow("2026-08-12"), "2026-08-13");
  assert.equal(clampToFourthPersonalRecordWindow("2026-08-13"), "2026-08-13");
  assert.equal(clampToFourthPersonalRecordWindow("2026-09-22"), "2026-09-22");
  assert.equal(clampToFourthPersonalRecordWindow("2026-12-31"), "2026-12-31");
  assert.equal(clampToFourthPersonalRecordWindow("2027-01-01"), "2026-12-31");
});
