import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function compile(path, names, deps = {}) {
  const source = read(path).replace(/^import .*;$/gm, "");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/\bexport /g, "");
  return new Function(...Object.keys(deps), `${js}\nreturn {${names.join(",")}};`)(...Object.values(deps));
}
const { isSupportedRasterSignature } = compile("lib/image-signature.ts", ["isSupportedRasterSignature"]);
const { getPrivateRunImageLocation } = compile("lib/private-run-image.ts", ["getPrivateRunImageLocation"], { MEMBER_UPLOAD_BUCKET: "member-run-uploads" });
const owner = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const batch = "33333333-3333-4333-8333-333333333333";
const id = "44444444-4444-4444-8444-444444444444";
const path = `run-records/4th/${owner}/${batch}/0-1720000000000.jpg`;
const jpeg = new Uint8Array([255, 216, 255, 224]);
test("인증 경로: 기존 3기·4기와 개인 업로드만 허용, 타 운영자·시즌·임의 URL 거절", () => {
  assert.equal(getPrivateRunImageLocation(path, owner, "4th").bucket, "photos");
  const old = path.replace("/4th/", "/");
  assert.equal(getPrivateRunImageLocation(old, owner, "3th").bucket, "photos");
  for (const [p, o, s] of [[path, member, "4th"], [path, owner, "3th"], [old, owner, "4th"], ["https://example.com/a.jpg", owner, "4th"], [path.replace("/0-", "/../0-"), owner, "4th"]]) assert.equal(getPrivateRunImageLocation(p, o, s), null);
  assert.equal(getPrivateRunImageLocation(`member-run-uploads/4th/${member}/2026-09-08/${"a".repeat(64)}/image.webp`, owner, "4th").bucket, "member-run-uploads");
});
test("이미지 시그니처: 실제 JPEG·PNG·WebP만 통과하고 위장 SVG/AVIF 거절", () => {
  assert.equal(isSupportedRasterSignature(jpeg, "image/jpeg"), true);
  assert.equal(isSupportedRasterSignature(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"), true);
  assert.equal(isSupportedRasterSignature(new TextEncoder().encode("RIFF0000WEBP"), "image/webp"), true);
  for (const bytes of [new TextEncoder().encode("<svg/>"), new TextEncoder().encode("0000ftypavif"), jpeg]) assert.equal(isSupportedRasterSignature(bytes, "image/png"), false);
});
function imageRoute(options = {}) {
  const calls = [];
  const record = { image_url: options.path ?? path, participant_id: member, season_key: options.season ?? "4th" };
  const service = {
    from(table) {
      const query = { select() { return query; }, eq(key, value) { calls.push([table, key, value]); return query; }, async maybeSingle() {
        if (table === "daily_run_records") return { data: options.missing ? null : record };
        return { data: options.unlinked ? null : { participant: { id: options.other ? id : member, user_id: owner, season_key: record.season_key, active: !options.inactive } } };
      } }; return query;
    },
    storage: { from(bucket) { calls.push(["bucket", bucket]); return { async download(p) { calls.push(["download", p]); return { data: new Blob([options.badImage ? "<svg/>" : jpeg]) }; } }; } },
  };
  const { GET } = compile("app/api/me/records/image/[id]/route.ts", ["GET"], {
    NextResponse: Response, memberJson: (body, status) => Response.json(body, { status }),
    guardReadRequest: () => null, requireAdminDataAccess: async () => options.admin ? { ok: true, user: { id: owner }, service } : { ok: false },
    resolvePersonalKakaoIdentity: async () => options.loggedOut ? { ok: false } : { ok: true, authUserId: member },
    getServiceClient: () => service, findAdminUserId: async () => owner,
    getPrivateRunImageLocation, isSupportedRasterSignature,
  });
  return { calls, run: (recordId = id) => GET({}, { params: Promise.resolve({ id: recordId }) }) };
}
test("인증샷 GET: 비로그인·미연결·타인·비활성 멤버는 파일을 읽기 전에 차단", async () => {
  for (const options of [{ loggedOut: true }, { unlinked: true }, { other: true }, { inactive: true }, { missing: true }]) {
    const h = imageRoute(options); assert.ok([401, 404].includes((await h.run()).status));
    assert.ok(!h.calls.some(c => c[0] === "download"));
  }
  const h = imageRoute(); assert.equal((await h.run("../../x")).status, 404); assert.deepEqual(h.calls, []);
});
test("인증샷 GET: 본인·운영자만 허용하며 응답을 공개 캐시하지 않는다", async () => {
  for (const options of [{}, { admin: true, unlinked: true, season: "3th", path: path.replace("/4th/", "/") }]) {
    const h = imageRoute(options); const response = await h.run(); assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("vary"), "Cookie");
    assert.ok(h.calls.some(c => c[0] === "daily_run_records" && c[1] === "user_id" && c[2] === owner));
    if (!options.admin) for (const field of ["auth_user_id", "participant_id", "season_key", "status"]) assert.ok(h.calls.some(c => c[0] === "participant_accounts" && c[1] === field));
  }
  assert.equal((await imageRoute({ badImage: true }).run()).status, 415);
});
test("청크 JSON: Content-Length 없이도 실제 용량 제한, 배열·잘못된 JSON 거절", async () => {
  const { readLimitedJson } = compile("lib/request-security.ts", ["readLimitedJson"], { NextResponse: Response });
  const request = text => new Request("https://example.com", { method: "POST", body: new ReadableStream({ start(controller) { for (const chunk of text) controller.enqueue(new TextEncoder().encode(chunk)); controller.close(); } }), duplex: "half" });
  assert.equal((await readLimitedJson(request(["{\"a\":", "1}"]), 8)).value.a, 1);
  const oversized = await readLimitedJson(request(["{\"a\":", "\"12345678\"}"]), 8);
  assert.equal(oversized.response.status, 413); assert.match(oversized.response.headers.get("cache-control"), /no-store/);
  for (const text of ["[]", "null", "bad"]) assert.equal((await readLimitedJson(request([text]), 20)).response.status, 400);
});
test("최신 UI 주석: 회전 간격·헤더·개인 기능 위치·간소화된 업로드", () => {
  const page = read("app/poc/hello-2027/hello-2027-poc.tsx");
  assert.match(page, /ENCOURAGEMENT_ROTATION_MS = 30_000/);
  assert.doesNotMatch(page.slice(page.indexOf("<header"), page.indexOf("</header>")), /styles\.seasonDday/);
  assert.match(page, /<PublicSiteHeader/); assert.match(read("components/public-site-header.tsx"), /Asia\/Seoul/); assert.doesNotMatch(page, /FourthDashboardMemberArea/);
  const content = read("components/my-activity-content.tsx");
  assert.match(content, /hidden=\{section !== "home"\} className=\{styles.featureSection\}/);
  assert.doesNotMatch(content, /<h3>프로필<\/h3>/); assert.match(content, /className=\{styles.profileCard\}/);
  assert.doesNotMatch(content, /나를 보여주는 프로필|카카오 계정 연동 완료|사진과 표시 이름은 멤버 목록에 공개/);
  const upload = read("components/my-activity-upload.tsx");
  assert.doesNotMatch(upload, /<h3>인증샷<\/h3>/); assert.match(upload, /<button className=\{styles.upload\}/);
  assert.doesNotMatch(upload, /JPG · PNG · WebP \/|Google Gemini로 전송돼요|>사진 선택</);
});
