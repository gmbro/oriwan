import assert from "node:assert/strict";
import test from "node:test";
import { getRecordMonthDays, shiftRecordMonth } from "../lib/participant-record-calendar.ts";

test("월 경계와 윤년에서도 인증 날짜가 올바른 요일 열에 위치한다", () => {
  const leap = getRecordMonthDays("2028-02");
  assert.equal(leap.filter(Boolean).length, 29);
  assert.equal(leap[2], "2028-02-01");
  assert.equal(leap[30], "2028-02-29");
  const november = getRecordMonthDays("2026-11");
  assert.equal(november[0], "2026-11-01");
  assert.equal(november.length % 7, 0);
  assert.equal(getRecordMonthDays("2026-08").length, 42);
});

test("이전 달과 다음 달 이동은 연도 경계를 넘을 수 있다", () => {
  assert.equal(shiftRecordMonth("2026-12", 1), "2027-01");
  assert.equal(shiftRecordMonth("2027-01", -1), "2026-12");
});
