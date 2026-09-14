import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as review from "../lib/certification-review.ts";

const id = "11111111-1111-4111-8111-111111111111";
const notes = review.writeCertificationReview("원본 메모", { version: 1, uploadedAt: "2026-10-07T22:59:59Z" });
const row = { id, participant_id: id, record_date: "2026-10-08", status: "needs_review", image_url: "private/image.webp", notes, distance_km: 5, duration_seconds: 1800 };
const json = (body, options) => ({ body, status: options?.status ?? 200 });
function harness({ body = {}, existing = row, denied = false, concurrent = false, insertConflict = false } = {}) {
  const calls = [];
  const service = { from(table) {
    let patch, insert;
    const query = {
      select() { return query; }, eq(key, value) { calls.push({ filter: [key, value] }); return query; }, is(key, value) { return query.eq(key, value); },
      update(value) { patch = value; return query; }, insert(value) { insert = value; calls.push({ insert: value }); return query; },
      async maybeSingle() {
        if (table === "participants") return { data: { id } };
        if (patch) { if (!concurrent) calls.push({ update: patch }); return { data: concurrent ? null : { id } }; }
        return { data: existing };
      },
      async single() { return insertConflict ? { error: { code: "23505" } } : { data: { id, status: insert?.status } }; },
    }; return query;
  } };
  const modules = {
    "@/lib/dashboard-refresh-server": { broadcastDashboardRefreshFromServer: async () => calls.push({broadcast:true}) },
    "next/server": { after: fn=>fn(), NextResponse: { json } },
    "@/lib/admin-data-access": { requireAdminDataAccess: async () => denied ? { ok: false, response: json({ error: "admin only" }, { status: 403 }) } : { ok: true, user: { id: "operator" }, service } },
    "@/lib/certification-review": { ...review, reviewCertification: input => review.reviewCertification({ ...input, now: "2026-10-08T01:00:00Z" }) },
    "@/lib/run-records": { calculatePaceSeconds: (distance, duration) => distance && duration ? duration / distance : null },
    "@/lib/request-security": { guardMutationRequest: () => null, readLimitedJson: async () => ({ ok: true, value: body }) },
    "@/lib/public-dashboard-data": { invalidatePublicDashboardCache: () => calls.push({ invalidated: true }) },
    "@/lib/fourth-season-contract": { FOURTH_SEASON_KEY: "4th", isWithinFourthPersonalRecordWindow: () => true },
    "@/lib/server-error-log": { logServerFailure: () => {} },
    "@/lib/supabase-errors": { isMissingTableError: () => false, missingSchemaResponse: () => ({}) },
  };
  const compile = path => {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    new Function("require", "exports", code)(name => { assert.ok(modules[name], `Unmocked dependency: ${name}`); return modules[name]; }, exports);
    return exports;
  };
  return { calls, patch: () => compile("app/api/records/[id]/route.ts").PATCH({}, { params: Promise.resolve({ id }) }), post: () => compile("app/api/records/route.ts").POST({}) };
}
const approval = { confirmed: true, evidenceConfirmed: true, captureDate: "2026-10-08", captureTime: "07:59", expectedImageUrl: row.image_url, expectedNotes: row.notes };
test("관리자 API는 비관리자 요청을 읽기·쓰기 전에 차단", async () => {
  const h = harness({ denied: true }); assert.equal((await h.patch()).status, 403); assert.deepEqual(h.calls, []);
});
test("기존 상태값만 보낸 클라이언트와 위조 접수 시각은 인증으로 승격할 수 없음", async () => {
  for (const body of [{ status: "certified" }, { status: "certified", approval: { expectedImageUrl: row.image_url, expectedNotes: notes } }, { status: "certified", approval: { ...approval, expectedNotes: "forged" } }]) {
    const h = harness({ body }); assert.ok((await h.patch()).status >= 400); assert.ok(!h.calls.some(c => c.update));
  }
});
test("정시 접수는 명시적 승인 시에만 certified와 관리자 승인 이력을 저장", async () => {
  const h = harness({ body: { status: "certified", approval } }); assert.equal((await h.patch()).status, 200);
  const saved = h.calls.find(c => c.update).update;
  assert.equal(saved.status, "certified"); assert.equal(review.readCertificationReview(saved.notes).approvedBy, "operator");
  assert.ok(h.calls.some(c => c.filter?.[0] === "image_url" && c.filter[1] === row.image_url));
});
test("관리자 승인은 08:00 이후 기록도 즉시 인증 완료", async () => {
  const late = { ...row, notes: review.writeCertificationReview("late", { version: 1, uploadedAt: "2026-10-07T23:00:00Z" }) };
  for (const time of ["08:00", "07:59"]) {
    const h = harness({ existing: late, body: { status: "certified", approval: { ...approval, expectedNotes: late.notes, evidenceConfirmed: true, captureDate: row.record_date, captureTime: time } } });
    assert.equal((await h.patch()).status, 200);
  }
});
test("거리 보정은 자동 승인하지 않으며 메모를 지워도 서버의 접수 시각은 유지", async () => {
  const h = harness({ body: { distance_km: 7, notes: "수정 메모\n[TWTT_REVIEW_V1]{\"version\":1,\"uploadedAt\":\"forged\"}" } });
  assert.equal((await h.patch()).status, 200);
  const saved = h.calls.find(c => c.update).update;
  assert.equal(saved.status, undefined); assert.equal(review.readCertificationReview(saved.notes).uploadedAt, "2026-10-07T22:59:59Z");
});
test("이미 승인된 기록의 단순 수정은 유지하고 날짜·멤버 이동은 검수 대기로 돌림", async () => {
  const existing = { ...row, status: "certified" };
  const edit = harness({ existing, body: { status: "certified", distance_km: 6 } }); assert.equal((await edit.patch()).status, 200);
  const moved = harness({ existing, body: { record_date: "2026-10-07" } }); assert.equal((await moved.patch()).status, 200); assert.equal(moved.calls.find(c => c.update).update.status, "needs_review");
});
test("검수 도중 다른 요청이 기록을 변경하면 승인하지 않고 409 반환", async () => {
  const h = harness({ concurrent: true, body: { status: "certified", approval } }); assert.equal((await h.patch()).status, 409); assert.ok(!h.calls.some(c => c.update));
});
test("관리자 직접 입력도 검수 대기로 저장하며 기존 기록을 덮어쓰지 않음", async () => {
  const body = { participant_id: id, record_date: row.record_date, distance_km: 5 };
  const h = harness({ body }); assert.equal((await h.post()).status, 200); assert.equal(h.calls.find(c => c.insert).insert.status, "needs_review");
  const bypass = harness({ body: { ...body, status: "certified" } }); assert.equal((await bypass.post()).status, 400); assert.ok(!bypass.calls.some(c => c.insert));
  const conflict = harness({ body, insertConflict: true }); assert.equal((await conflict.post()).status, 409);
});
test("관리자 OCR은 멤버·날짜·거리가 모두 확실해도 자동 승인하지 않음", () => {
  const source = readFileSync(new URL("../app/api/records/analyze/route.ts", import.meta.url), "utf8");
  const decide = source.slice(source.indexOf("function decideStatus("), source.indexOf("async function analyzeImage("));
  const code = ts.transpileModule(decide, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const status = new Function(`${code}; return decideStatus;`)();
  assert.equal(status({ participantId: id, recordDate: row.record_date, distanceKm: 5, durationSeconds: 1800, dateWasFallback: false }), "needs_review");
});
