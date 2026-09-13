import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../app/api/hello-2027/comments/route.ts", import.meta.url), "utf8");
const patchSource = source.slice(source.indexOf("export async function PATCH("), source.indexOf("export async function DELETE("));
const compiled = ts.transpileModule(patchSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("export async function PATCH", "async function PATCH");
const id = "d5179c81-c9c2-47e9-b78f-276ec8bc321a";
const version = "2026-09-08T00:00:00.123456+00:00";
function harness(options = {}) {
  const calls = [];
  let update;
  const filters = {};
  const query = {
    update(value) { update = value; calls.push("update"); return query; },
    eq(key, value) { filters[key] = value; return query; },
    select() { return query; },
    async maybeSingle() {
      const allowed = filters.actor_key === (options.owner ?? "verified-owner") && filters.status === "visible" && filters.updated_at === (options.version ?? version);
      return { data: allowed ? { id, body: update.body, updated_at: update.updated_at } : null };
    },
  };
  const deps = {
    hasApprovedFourthViewer: async () => options.approved !== false,
    guardMutationRequest: () => options.guard ?? null,
    HELLO_2027_COMMENTS_LIVE: true, HELLO_2027_COMMENTS_SEASON: "4th",
    commentsDisabledResponse: () => ({ status: 403 }),
    readHello2027JsonBody: async () => ({ ok: true, value: { id, body: "수정 내용", expected_updated_at: version, actor_key: "forged", status: "visible", ...options.input } }),
    normalizeCommentBody: value => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 150 ? value.trim() : null,
    UUID_PATTERN: /^[0-9a-f-]{36}$/i,
    publicJson: (body, status = 200) => ({ status, body }),
    resolveHello2027CommentActor: async () => ({ user: options.unauthenticated ? null : { id: "owner" }, actorKey: "verified-owner", authError: false }),
    getHello2027CommentsService: () => ({ from(table) { assert.equal(table, "hello_2027_comments"); return query; } }),
    toHello2027Comment: row => ({ id: row.id, body: row.body, updatedAt: row.updated_at }),
    logServerFailure: () => {}, invalidatePublicDashboardCache: () => calls.push("invalidate"),
    after: callback => { calls.push("after"); }, broadcastDashboardRefreshFromServer: () => {},
  };
  const PATCH = new Function(...Object.keys(deps), `${compiled}\nreturn PATCH;`)(...Object.values(deps));
  return { PATCH, calls, filters, get update() { return update; } };
}

test("댓글 PATCH는 비로그인·CSRF·빈 본문을 DB 수정 전에 거절한다", async () => {
  for (const [options, status] of [[{ unauthenticated: true }, 401], [{ guard: { status: 403 } }, 403], [{ input: { body: "  " } }, 400], [{ input: { expected_updated_at: "bad" } }, 400]]) {
    const h = harness(options); assert.equal((await h.PATCH({})).status, status); assert.deepEqual(h.calls, []);
  }
});
test("댓글 PATCH는 요청의 소유자·상태를 무시하고 검증된 소유자·시즌·공개상태·기존시각으로 원자적 수정", async () => {
  const h = harness(); const response = await h.PATCH({});
  assert.equal(response.status, 200);
  assert.deepEqual(h.filters, { id, season_key: "4th", actor_key: "verified-owner", status: "visible", updated_at: version });
  assert.deepEqual(Object.keys(h.update).sort(), ["body", "updated_at"]);
  assert.equal(response.body.comment.updatedAt, h.update.updated_at);
  assert.ok(Number.isFinite(Date.parse(h.update.updated_at)));
  assert.deepEqual(h.calls, ["update", "invalidate", "after"]);
});
test("타인의 댓글·오래된 수정 폼은 변경하지 않고 409를 반환한다", async () => {
  for (const options of [{ owner: "someone-else" }, { version: "2026-09-08T01:00:00.000Z" }]) {
    const h = harness(options); assert.equal((await h.PATCH({})).status, 409); assert.deepEqual(h.calls, ["update"]);
  }
});

test('비로그인·승인 대기 사용자의 댓글 목록 요청은 저장소 조회 없이 차단한다',async()=>{
 const getSource=source.slice(source.indexOf('export async function GET('),source.indexOf('export async function POST('));
 const js=ts.transpileModule(getSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('export async function GET','async function GET');
 const GET=new Function('guardReadRequest','hasApprovedFourthViewer','NextResponse',`${js};return GET;`)(()=>null,async()=>false,{json:(body,init)=>({body,...init})});
 const result=await GET({});assert.equal(result.status,403);assert.deepEqual(result.body,{error:'접근할 수 없습니다.'});
});
