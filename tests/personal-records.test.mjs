import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/fourth-season-contract") {
      return nextResolve(
        new URL("../lib/fourth-season-contract.ts", import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

const { buildPersonalRecordsPayload } = await import("../lib/personal-records.ts");

const DAY_MS = 86_400_000;

function addDays(value, count) {
  return new Date(Date.parse(`${value}T00:00:00Z`) + count * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function makeRecord(id, date, overrides = {}) {
  return {
    id,
    date,
    status: "certified",
    distanceKm: 5,
    durationSeconds: 1_800,
    paceSecondsPerKm: 360,
    isRecovery: false,
    ...overrides,
  };
}

test("9월 22일 준비 기록은 개인 요약과 목록에만 남고 공식 지표에는 섞이지 않는다", () => {
  const payload = buildPersonalRecordsPayload([
    makeRecord("preseason", "2026-09-22", {
      distanceKm: 4.2,
      durationSeconds: 1_512,
    }),
  ], "2026-09-23");

  assert.deepEqual(payload.summary.preseason, {
    certifiedDays: 1,
    totalDistanceKm: 4.2,
    totalDurationSeconds: 1_512,
  });
  assert.equal(payload.records.length, 1);
  assert.equal(payload.records[0].phase, "preseason");
  assert.equal(payload.records[0].countsTowardOfficial, false);

  assert.equal(payload.summary.official.certifiedDays, 0);
  assert.equal(payload.summary.official.certificationRate, 0);
  assert.equal(payload.summary.official.totalDistanceKm, 0);
  assert.equal(payload.series.calendar.some((day) => day.date === "2026-09-22"), false);
  assert.equal(payload.series.calendar[0].date, "2026-09-23");
  assert.equal(payload.series.calendar[0].state, "missed");
  assert.equal(payload.series.weekly[0].certifiedDays, 0);
  assert.equal(payload.series.weekly[0].distanceKm, 0);
});

test("9월 23일부터 공식 인증으로 전환되고 준비 기록과 누계가 분리된다", () => {
  const payload = buildPersonalRecordsPayload([
    makeRecord("preseason", "2026-09-22", { distanceKm: 2 }),
    makeRecord("opening-day", "2026-09-23", { distanceKm: 7 }),
  ], "2026-09-23");

  assert.equal(payload.season.phase, "active");
  assert.equal(payload.season.elapsedOfficialDays, 1);
  assert.equal(payload.summary.preseason.certifiedDays, 1);
  assert.equal(payload.summary.official.certifiedDays, 1);
  assert.equal(payload.summary.official.certificationRate, 100);
  assert.equal(payload.summary.official.totalDistanceKm, 7);
  assert.deepEqual(
    payload.records.map(({ date, phase, countsTowardOfficial }) => ({
      date,
      phase,
      countsTowardOfficial,
    })),
    [
      { date: "2026-09-23", phase: "official", countsTowardOfficial: true },
      { date: "2026-09-22", phase: "preseason", countsTowardOfficial: false },
    ],
  );
  assert.deepEqual(payload.series.calendar[0], {
    date: "2026-09-23",
    dayNumber: 1,
    state: "certified",
  });
  assert.equal(payload.series.weekly[0].certifiedDays, 1);
  assert.equal(payload.series.weekly[0].distanceKm, 7);
  assert.deepEqual(payload.series.cumulativeDistance, [
    { date: "2026-09-22", phase: "preseason", cumulativeKm: 2 },
    { date: "2026-09-23", phase: "official", cumulativeKm: 7 },
  ]);
});

test("검수 대기·반려·미인증 기록은 공식 요약과 연속 기록에서 제외한다", () => {
  const payload = buildPersonalRecordsPayload([
    makeRecord("certified", "2026-09-23"),
    makeRecord("review", "2026-09-24", { status: "needs_review" }),
    makeRecord("rejected", "2026-09-25", { status: "rejected" }),
    makeRecord("missing", "2026-09-26", { status: "missing" }),
  ], "2026-09-26");

  assert.equal(payload.records.length, 4);
  assert.equal(payload.records.filter((record) => record.countsTowardOfficial).length, 1);
  assert.equal(payload.summary.official.certifiedDays, 1);
  assert.equal(payload.summary.official.totalDistanceKm, 5);
  assert.equal(payload.summary.official.totalDurationSeconds, 1_800);
  assert.equal(payload.summary.official.longestStreak, 1);
  assert.equal(payload.summary.official.currentStreak, 0);
  assert.deepEqual(
    payload.series.calendar.slice(0, 4).map((day) => day.state),
    ["certified", "review", "missed", "missed"],
  );
  assert.equal(payload.series.weekly[0].certifiedDays, 1);
});

test("100일 전체는 달력·주간·연속 기록에서 하루도 빠짐없이 집계된다", () => {
  const records = Array.from({ length: 100 }, (_, index) => (
    makeRecord(`day-${index + 1}`, addDays("2026-09-23", index), {
      distanceKm: 1,
      durationSeconds: 360,
    })
  ));
  const payload = buildPersonalRecordsPayload(records, "2026-12-31");

  assert.equal(payload.season.phase, "active");
  assert.equal(payload.season.elapsedOfficialDays, 100);
  assert.equal(payload.summary.official.certifiedDays, 100);
  assert.equal(payload.summary.official.certificationRate, 100);
  assert.equal(payload.summary.official.currentStreak, 100);
  assert.equal(payload.summary.official.longestStreak, 100);
  assert.equal(payload.series.calendar.length, 100);
  assert.deepEqual(payload.series.calendar.at(-1), {
    date: "2026-12-31",
    dayNumber: 100,
    state: "certified",
  });
  assert.equal(payload.series.weekly.length, 15);
  assert.deepEqual(payload.series.weekly.at(-1), {
    weekNumber: 15,
    from: "2026-12-30",
    to: "2026-12-31",
    targetDays: 2,
    elapsedDays: 2,
    certifiedDays: 2,
    distanceKm: 2,
  });
});

test("연속 기록은 공식 인증일만 사용하고 중간 공백과 오늘 미인증을 반영한다", () => {
  const records = [
    makeRecord("streak-a-1", "2026-09-23"),
    makeRecord("streak-a-2", "2026-09-24"),
    makeRecord("streak-b-1", "2026-09-26"),
    makeRecord("streak-b-2", "2026-09-27"),
    makeRecord("streak-b-3", "2026-09-28"),
    makeRecord("preseason", "2026-09-22"),
  ];

  const throughCertifiedToday = buildPersonalRecordsPayload(records, "2026-09-28");
  assert.equal(throughCertifiedToday.summary.official.currentStreak, 3);
  assert.equal(throughCertifiedToday.summary.official.longestStreak, 3);

  const throughMissedToday = buildPersonalRecordsPayload(records, "2026-09-29");
  assert.equal(throughMissedToday.summary.official.currentStreak, 0);
  assert.equal(throughMissedToday.summary.official.longestStreak, 3);
});

test("같은 날짜의 중복 인증은 하루로만 집계하고 미래·기간 밖 기록은 숨긴다", () => {
  const payload = buildPersonalRecordsPayload([
    makeRecord("duplicate-a", "2026-09-23"),
    makeRecord("duplicate-b", "2026-09-23"),
    makeRecord("today", "2026-09-24"),
    makeRecord("future", "2026-09-25"),
    makeRecord("before-personal-window", "2026-08-12"),
    makeRecord("after-season", "2027-01-01"),
  ], "2026-09-24");

  assert.deepEqual(payload.records.map((record) => record.id), [
    "today",
    "duplicate-a",
    "duplicate-b",
  ]);
  assert.equal(payload.summary.official.certifiedDays, 2);
  assert.equal(payload.summary.official.totalDistanceKm, 10);
  assert.equal(payload.summary.official.totalDurationSeconds, 3_600);
  assert.equal(payload.summary.official.certificationRate, 100);
  assert.equal(payload.records.filter((record) => record.countsTowardOfficial).length, 2);
  assert.equal(payload.series.weekly[0].certifiedDays, 2);
  assert.equal(payload.series.weekly[0].distanceKm, 10);
  assert.equal(payload.series.calendar[2].date, "2026-09-25");
  assert.equal(payload.series.calendar[2].state, "future");
});

test("같은 날짜에 검수 기록과 인증 기록이 함께 있어도 요약과 달력이 인증으로 일치한다", () => {
  const payload = buildPersonalRecordsPayload([
    makeRecord("a-certified", "2026-09-23", { distanceKm: 6 }),
    makeRecord("z-review", "2026-09-23", { status: "needs_review", distanceKm: 0 }),
  ], "2026-09-23");

  assert.equal(payload.summary.official.certifiedDays, 1);
  assert.equal(payload.summary.official.totalDistanceKm, 6);
  assert.equal(payload.series.calendar[0].state, "certified");
  assert.equal(payload.series.weekly[0].certifiedDays, 1);
});

test("같은 날 일반 인증과 리커버리 인증이 겹치면 일반 인증을 대표 기록으로 사용한다", () => {
  const payload = buildPersonalRecordsPayload([
    makeRecord("recovery", "2026-09-23", {
      distanceKm: 1,
      durationSeconds: 60,
      isRecovery: true,
    }),
    makeRecord("regular", "2026-09-23", {
      distanceKm: 5,
      durationSeconds: 1_800,
      isRecovery: false,
    }),
  ], "2026-09-23");

  assert.equal(payload.summary.official.totalDistanceKm, 5);
  assert.equal(payload.series.calendar[0].state, "certified");
  assert.equal(payload.summary.official.averagePaceSecondsPerKm, 360);
});

test("시즌 종료 후에도 공식 분모는 100일을 넘지 않고 종료일 뒤 기록은 제외한다", () => {
  const payload = buildPersonalRecordsPayload([
    makeRecord("last-day", "2026-12-31"),
    makeRecord("after-season", "2027-01-01"),
  ], "2027-01-15");

  assert.equal(payload.season.phase, "complete");
  assert.equal(payload.season.elapsedOfficialDays, 100);
  assert.equal(payload.summary.official.certifiedDays, 1);
  assert.equal(payload.summary.official.certificationRate, 1);
  assert.deepEqual(payload.records.map((record) => record.id), ["last-day"]);
  assert.equal(payload.series.calendar.at(-1).state, "certified");
  assert.equal(payload.series.weekly.at(-1).elapsedDays, 2);
});
