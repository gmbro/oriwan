import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { validateMemberSubmission, ownsFreshDraft, MEMBER_UPLOAD_DRAFT_PATTERN } from "../lib/member-upload-contract.ts";
import { activityChart } from "../lib/my-activity-chart.ts";
const today = "2026-10-08";
const input = { date: today, distanceKm: 5.2, durationSeconds: 1930 };
test("개인 제출: 정상 값만 허용, 미래 날짜·시즌 밖·빈 값·비정상 수치 거절", () => {
  assert.equal(validateMemberSubmission(input, today).ok, true);
  for (const patch of [{ date: "2026-10-09" }, { date: "2026-08-12" }, { date: "2026-02-31" }, { date: "hello" }, { distanceKm: 0 }, { distanceKm: NaN }, { distanceKm: Infinity }, { distanceKm: "5.2" }, { durationSeconds: 0 }, { durationSeconds: 1.5 }, { durationSeconds: 172801 }]) assert.equal(validateMemberSubmission({ ...input, ...patch }, today).ok, false, JSON.stringify(patch));
});
test("개인 제출: 다른 계정, 만료·미래 초안, 경로 조작 거절", () => {
  const now = Date.parse("2026-10-08T00:00:00Z");
  const draft = { participantId: "owner", createdAt: new Date(now - 1000).toISOString() };
  assert.equal(ownsFreshDraft(draft, "owner", now), true);
  assert.equal(ownsFreshDraft(draft, "other", now), false);
  assert.equal(ownsFreshDraft(draft, "owner", now + 86400000), false);
  assert.equal(ownsFreshDraft({ ...draft, createdAt: "invalid" }, "owner", now), false);
  assert.equal(ownsFreshDraft({ ...draft, createdAt: new Date(now + 1000).toISOString() }, "owner", now), false);
  assert.equal(MEMBER_UPLOAD_DRAFT_PATTERN.test(`2026-10-08/${"a".repeat(64)}`), true);
  for (const path of ["../../other", "2026-10-08/../other", "2026-10-08/a", "https://example.com"]) assert.equal(MEMBER_UPLOAD_DRAFT_PATTERN.test(path), false);
});
test("누적 그래프: 승인된 공식 기록만 포함하고 날짜 중복은 한 번 집계", () => {
  const base = { id: "1", date: "2026-10-08", status: "certified", countsTowardOfficial: true, distanceKm: 5.2, durationSeconds: 1930 };
  const records = [base, base, { ...base, date: "2026-10-07", status: "needs_review" }, { ...base, date: "2026-09-01", countsTowardOfficial: false }];
  assert.equal(activityChart(records, today, "distance", "week").at(-1).value, 5.2);
  assert.equal(activityChart(records, today, "days", "month").at(-1).value, 1);
  assert.equal(activityChart(records, today, "time", "all").at(-1).value, 32.17);
  assert.equal(activityChart([], "2026-09-08", "days", "all").length, 0);
  assert.equal(activityChart([], "2026-11-20", "days", "week").length, 7);
  assert.equal(activityChart([], "2026-11-20", "days", "month").length, 30);
});
const geminiSource = readFileSync(new URL("../lib/gemini.ts", import.meta.url), "utf8");
const geminiJs = ts.transpileModule(geminiSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace('from "@google/genai"', `from ${JSON.stringify(import.meta.resolve("@google/genai"))}`);
const gemini = await import(`data:text/javascript;base64,${Buffer.from(geminiJs).toString("base64")}`);
test("OCR: 사용 가능한 저비용 단일 모델, 최소 thinking, 고가 fallback 부활 불가", () => {
  process.env.GEMINI_OCR_FALLBACK_MODEL = "expensive-model";
  assert.deepEqual(gemini.resolveGeminiOcrModels(), ["gemini-3.1-flash-lite"]);
  assert.deepEqual(gemini.getGeminiOcrConfig(gemini.GEMINI_OCR_MODEL).thinkingConfig, { thinkingLevel: "MINIMAL" });
  delete process.env.GEMINI_OCR_FALLBACK_MODEL;
});
test("공개 멤버 상세는 사진 파일 입력·수정 API가 없고 날씨 배지는 제거됨", () => {
  const source = readFileSync(new URL("../app/poc/hello-2027/hello-2027-poc.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /canEditProfileImage|profileInputRef|fetch\("\/api\/me\/profile-image/);
  const banner = readFileSync(new URL("../app/poc/hello-2027/hello-2027-crew-banner.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(banner, /weatherCredit|weatherSource/);
  assert.match(banner, /useGangnamWeather/);
});
test("내 활동은 헤더 밖에 배치되어 모바일 날짜 숨김·nowrap 규칙을 상속하지 않는다", () => {
  const page = readFileSync(new URL("../app/poc/hello-2027/hello-2027-poc.tsx", import.meta.url), "utf8");
  assert.ok(page.indexOf("<MyActivityDialog") > page.indexOf("</main>"));
  assert.match(page, /showTrigger=\{false\}/);
  const css = readFileSync(new URL("../components/my-activity.module.css", import.meta.url), "utf8");
  assert.match(css, /\.dialog\s*\{[^}]*white-space:\s*normal/);
  const headerCss = readFileSync(new URL("../app/poc/hello-2027/hello-2027-poc.module.css", import.meta.url), "utf8");
  assert.doesNotMatch(headerCss, /\.headerAccountLink\s*\{\s*display:\s*none/);
});

test("내 정보 첫 화면은 프로필·인증샷·기록·운영자 후원 네 칸과 하단 개인 기능을 제공한다", () => {
  const source = readFileSync(new URL("../components/my-activity-content.tsx", import.meta.url), "utf8");
  for (const title of ["프로필", "인증샷", "기록"]) assert.ok(source.includes(`title: "${title}"`));
  assert.match(source, /FourthDashboardMemberArea embedded/);
  assert.doesNotMatch(source, /나의 작성 내용과 개인 기능|오늘의 기록을 남겨보세요|사진과 표시 이름을 바꿔요|그래프와 인증 캘린더를 살펴봐요/);
  const css = readFileSync(new URL("../components/my-activity.module.css", import.meta.url), "utf8");
  assert.match(css, /\.menuList\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
});
test("공개 댓글은 본인 수정·삭제가 가능하며 빈 안내 영역과 중복 관리 버튼은 없다", () => {
  const source = readFileSync(new URL("../app/poc/hello-2027/hello-2027-guestbook.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /onManage|내 활동에서 댓글 작성·관리/);
  assert.match(source, /thread\.ownedByViewer && viewer\?\.authenticated/);
  assert.match(source, /reply\.ownedByViewer && viewer\?\.authenticated/);
  assert.match(source, /announcement \? <p/);
  assert.match(source, /수정 \{formatKoreanDateTime\(updatedAt\)\}/);
});
