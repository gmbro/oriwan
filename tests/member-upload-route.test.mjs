import { writeCertificationReview, readCertificationReview } from "../lib/certification-review.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { memberUploadRecordValues, memberEvidenceIssues, hasMemberUploadEvidence, MEMBER_UPLOAD_BUCKET, MEMBER_UPLOAD_DRAFT_PATTERN, ownsFreshDraft, validateMemberSubmission, validateCertificationDate } from "../lib/member-upload-contract.ts";

// Execute the actual POST body with injected auth/storage/DB ports. Tests never
// contact production and deliberately send forged ownership/status fields.
const source = readFileSync(new URL("../app/api/me/records/route.ts", import.meta.url), "utf8");
const post = ts.transpileModule(source.slice(source.indexOf("export async function POST(")), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("export async function POST", "async function POST");
const json = (body, status = 200) => ({ status, body });
function harness(overrides = {}) {
  const calls = [];
  const draftId = `2026-10-08/${"a".repeat(64)}`;
  const body = { draftId, date: "2026-10-08", distanceKm: 5.2, durationSeconds: 1930, participant_id: "victim", user_id: "victim-admin", status: "certified", ...overrides.body };
  const draft = { participantId: "owner", createdAt: new Date().toISOString(), date: body.date, activityTime: "07:35", distanceKm: 5, durationSeconds: 1900, rawText: "original OCR", confidence: .9, model: "gemini-3.1-flash-lite", ...overrides.draft };
  const service = { from(table) {
    assert.equal(table, "daily_run_records");
    return { insert(row) { calls.push({ insert: row }); return { select() { return { async single() { return overrides.databaseError ? { error: overrides.databaseError } : { data: { id: "saved", status: row.status } }; } }; } }; },
      select() { const query = { eq(key, value) { calls.push({ filter: [key, value] }); return query; }, async maybeSingle() { return { data: overrides.existing }; } }; return query; } };
  } };
  const owned = overrides.unauthenticated ? { response: json({ error: "login" }, 401) } : { context: { service, authUserId: "auth-owner" }, participantId: "owner", adminUserId: "operator" };
  const deps = {
    guardMutationRequest: () => null, ownedMember: async () => owned,
    readMemberJson: async () => ({ body }), MEMBER_UPLOAD_DRAFT_PATTERN, validateMemberSubmission, validateCertificationDate,
    toKstIsoDate: overrides.today || (() => "2026-10-08"), privateJson: json,
    privateUploadStore: async () => { calls.push({ storage: true }); return {}; },
    uploadPrefix: (owner, id) => `4th/${owner}/${id}`, readUploadDraft: async () => draft,
    memberUploadRecordValues, memberEvidenceIssues, hasMemberUploadEvidence, writeCertificationReview, ownsFreshDraft, MEMBER_UPLOAD_BUCKET, FOURTH_SEASON_KEY: "4th",
    calculatePaceSeconds: (distance, duration) => Math.round(duration / distance),
    invalidatePublicDashboardCache: () => calls.push({ invalidated: true }),
    after: () => {}, broadcastDashboardRefreshFromServer: () => {},
  };
  const POST = new Function(...Object.keys(deps), `${post}\nreturn POST;`)(...Object.values(deps));
  return { calls, POST, draftId };
}
test("개인 POST: 비로그인은 저장소·DB를 만지기 전에 차단", async () => {
  const h = harness({ unauthenticated: true }); assert.equal((await h.POST({})).status, 401); assert.deepEqual(h.calls, []);
});
test("개인 POST: 요청의 타인 ID·certified 상태를 무시하고 서버 소유자로 즉시 인증", async () => {
  const h = harness(); assert.equal((await h.POST({})).status, 201);
  const row = h.calls.find(c => c.insert).insert;
  assert.equal(row.user_id, "operator"); assert.equal(row.participant_id, "owner"); assert.equal(row.status, "certified");
  assert.equal(readCertificationReview(row.notes).uploadedAt !== null, true);
  assert.equal(row.raw_extracted_text, "original OCR"); assert.match(row.notes, /OCR 원본.*확정 기록/s);
  assert.match(row.image_url, /^member-run-uploads\/4th\/auth-owner\//);
});
test("개인 POST: 타인의 초안과 만료된 초안은 INSERT 없이 거절", async () => {
  for (const patch of [{ participantId: "victim" }, { createdAt: "2020-01-01T00:00:00Z" }]) {
    const h = harness({ draft: patch }); assert.equal((await h.POST({})).status, 410); assert.ok(!h.calls.some(c => c.insert));
  }
});
test("개인 POST: 같은 사진·날짜 더블클릭은 기존 기록을 반환하고 타 기록은 덮어쓰지 않음", async () => {
  const draftId = `2026-10-08/${"a".repeat(64)}`;
  const h = harness({ databaseError: { code: "23505" }, existing: { id: "existing", status: "certified", image_url: `member-run-uploads/4th/auth-owner/${draftId}/image.webp` } });
  const result = await h.POST({}); assert.equal(result.status, 200); assert.equal(result.body.duplicate, true); assert.equal(result.body.record.status, "certified");
  assert.ok(h.calls.some(c => c.filter?.[0] === "participant_id" && c.filter[1] === "owner"));
  const conflicting = harness({ databaseError: { code: "23505" }, existing: { id: "existing", image_url: "operator-original.webp" } });
  assert.equal((await conflicting.POST({})).status, 409);
});

test("OCR 값이 없어도 회원이 입력한 유효한 기록은 즉시 인증", async () => {
  for (const draft of [{ activityTime: null }, { activityTime: "24:00" }, { distanceKm: null }, { distanceKm: 0 }]) {
    const h = harness({ draft });
    const result = await h.POST({});
    assert.equal(result.status, 201);
    assert.equal(h.calls.find(c => c.insert).insert.status, "certified");
  }
});


test("사진 날짜가 없거나 과거·미래여도 본인이 선택한 유효한 날짜에 인증",async()=>{
 for(const date of [null,"2025-01-01","2027-01-01"]){
  const h=harness({body:{date:"2026-09-20"},draft:{date,activityDate:date}});const response=await h.POST({});assert.equal(response.status,201);
  const row=h.calls.find(c=>c.insert).insert;assert.equal(row.record_date,"2026-09-20");assert.equal(response.body.record.date,row.record_date);
 }
});
test("선택 날짜가 잘못되거나 미래·시즌 밖이면 저장하지 않음",async()=>{
 for(const date of ["2026-09-31","2026-10-09","2026-08-12","2027-01-01","",42]){
  const h=harness({body:{date}});assert.equal((await h.POST({})).status,400);assert.ok(!h.calls.some(c=>c.insert));
 }
});
test("배경 사진이나 OCR 장애로 수치를 못 읽어도 인증하고 수치는 null 보관",async()=>{
 for(const draft of [{distanceKm:null,durationSeconds:null},{analysisError:"timeout",distanceKm:5,durationSeconds:30}]){
 const h=harness({draft});assert.equal((await h.POST({})).status,201);const row=h.calls.find(c=>c.insert).insert;assert.equal(row.status,"certified");assert.equal(row.distance_km,null);assert.equal(row.duration_seconds,null);assert.match(row.image_url,/member-run-uploads/);
 }
});
test("업로드 일자는 한국시간 자정 기준이고 사진 날짜·요청 날짜에 영향받지 않음",()=>{
 const base={createdAt:"2026-09-15T14:59:59.999Z",date:"2000-01-01",distanceKm:null,durationSeconds:null};
 assert.equal(memberUploadRecordValues(base).date,"2026-09-15");assert.equal(memberUploadRecordValues({...base,createdAt:"2026-09-15T15:00:00.000Z"}).date,"2026-09-16");
});
