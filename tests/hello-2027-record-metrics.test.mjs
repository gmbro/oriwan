import assert from "node:assert/strict";
import test from "node:test";

const {
  groupHello2027ParticipantRecords,
  roundHello2027DurationMinutes,
  sumHello2027OfficialMetrics,
} = await import("../lib/hello-2027-record-metrics.ts");

const DATES = {
  personalStartDate: "2026-08-13",
  officialStartDate: "2026-09-23",
  seasonEndDate: "2026-12-31",
};

function makeRecord(overrides = {}) {
  return {
    participant_id: "member-a",
    record_date: "2026-09-07",
    distance_km: 5,
    duration_seconds: 1_800,
    status: "needs_review",
    created_at: "2026-09-07T01:00:00.000Z",
    ...overrides,
  };
}

function group(records, throughDate = "2026-09-07") {
  return groupHello2027ParticipantRecords({
    records,
    participantIds: new Set(["member-a"]),
    throughDate,
    ...DATES,
  });
}

test("시즌 시작 전 OCR 검수 대기 기록은 개인창 거리·시간에만 포함한다", () => {
  const result = group([makeRecord()]);

  assert.equal(result.officialCertifiedByParticipant.get("member-a"), undefined);
  assert.deepEqual(
    result.visibleMetricsByParticipant.get("member-a")?.map((record) => ({
      distance: record.distance_km,
      duration: record.duration_seconds,
    })),
    [{ distance: 5, duration: 1_800 }],
  );
});

test("공식 기간의 검수 대기 기록도 개인창 지표에는 보이지만 인증일에는 포함하지 않는다", () => {
  const pending = makeRecord({ record_date: "2026-09-24" });
  const result = group([pending], "2026-09-24");

  assert.equal(result.officialCertifiedByParticipant.get("member-a"), undefined);
  assert.deepEqual(result.visibleMetricsByParticipant.get("member-a"), [pending]);
});

test("같은 날짜의 검수 대기와 승인 기록을 한 번만 집계하고 승인값을 우선한다", () => {
  const pending = makeRecord({
    record_date: "2026-09-24",
    distance_km: 4.8,
    duration_seconds: 1_740,
    created_at: "2026-09-24T02:00:00.000Z",
  });
  const certified = makeRecord({
    record_date: "2026-09-24",
    distance_km: 5,
    duration_seconds: 1_800,
    status: "certified",
    created_at: "2026-09-24T01:00:00.000Z",
  });
  const result = group([pending, certified], "2026-09-24");

  assert.deepEqual(result.officialCertifiedByParticipant.get("member-a"), [certified]);
  assert.deepEqual(result.visibleMetricsByParticipant.get("member-a"), [certified]);
});

test("유효한 OCR 수치가 없는 검수 행은 개인창 합계에서 제외한다", () => {
  const result = group([
    makeRecord({ distance_km: null, duration_seconds: null }),
    makeRecord({
      record_date: "2026-09-08",
      distance_km: -1,
      duration_seconds: Number.NaN,
    }),
  ], "2026-09-08");

  assert.equal(result.visibleMetricsByParticipant.get("member-a"), undefined);
  assert.equal(result.visibleHistoryByParticipant.get("member-a"), undefined);
  assert.equal(result.officialCertifiedByParticipant.get("member-a"), undefined);
});

test("수치가 비어도 승인된 공식 인증일은 캘린더 이력에 남긴다", () => {
  const certifiedWithoutMetrics = makeRecord({
    record_date: "2026-09-23",
    distance_km: null,
    duration_seconds: null,
    status: "certified",
  });
  const result = group([certifiedWithoutMetrics], "2026-09-23");

  assert.deepEqual(result.officialCertifiedByParticipant.get("member-a"), [certifiedWithoutMetrics]);
  assert.equal(result.visibleMetricsByParticipant.get("member-a"), undefined);
  assert.deepEqual(result.visibleHistoryByParticipant.get("member-a"), [certifiedWithoutMetrics]);
});

test("0초 기록은 1분으로 올리지 않고 그대로 0분으로 표시한다", () => {
  assert.equal(roundHello2027DurationMinutes(0), 0);
  assert.equal(roundHello2027DurationMinutes(30), 1);
  assert.equal(roundHello2027DurationMinutes(null), null);
  assert.equal(roundHello2027DurationMinutes(-1), null);
});

test("승인 기록은 날짜별 하나만 공식 인증일로 유지한다", () => {
  const older = makeRecord({
    record_date: "2026-09-23",
    status: "certified",
    distance_km: 5,
    created_at: "2026-09-23T01:00:00.000Z",
  });
  const newer = makeRecord({
    record_date: "2026-09-23",
    status: "certified",
    distance_km: 6,
    created_at: "2026-09-23T02:00:00.000Z",
  });
  const result = group([older, newer], "2026-09-23");

  assert.deepEqual(result.officialCertifiedByParticipant.get("member-a"), [newer]);
  assert.deepEqual(result.visibleMetricsByParticipant.get("member-a"), [newer]);
});

test("공통 누적 거리는 공식 승인 행만 중복 없이 합산하고 시간은 합산 후 반올림한다", () => {
  const result = groupHello2027ParticipantRecords({
    ...DATES, participantIds: new Set(["member-a", "member-b"]), throughDate: "2026-09-25",
    records: [
      makeRecord({ status: "certified" }), // Pre-season.
      makeRecord({ record_date: "2026-09-23", status: "needs_review", distance_km: 99 }),
      makeRecord({ record_date: "2026-09-23", status: "certified", distance_km: 1.1, duration_seconds: 31 }),
      makeRecord({ record_date: "2026-09-23", status: "certified", distance_km: 1.1, duration_seconds: 31 }),
      makeRecord({ participant_id: "member-b", record_date: "2026-09-23", status: "certified", distance_km: 2.2, duration_seconds: 31 }),
      makeRecord({ record_date: "2026-09-24", status: "certified", distance_km: -1, duration_seconds: Number.NaN }),
      makeRecord({ record_date: "2026-09-25", status: "certified", distance_km: null, duration_seconds: null }),
      makeRecord({ participant_id: "not-visible", record_date: "2026-09-23", status: "certified" }),
      makeRecord({ record_date: "2026-09-26", status: "certified" }), // Future.
      makeRecord({ record_date: "2027-01-01", status: "certified" }), // Outside season.
    ],
  });
  assert.deepEqual(sumHello2027OfficialMetrics(result.officialCertifiedByParticipant), { distanceKm: 3.3, durationMinutes: 1 });
  assert.deepEqual(sumHello2027OfficialMetrics(new Map()), { distanceKm: 0, durationMinutes: 0 });
});
