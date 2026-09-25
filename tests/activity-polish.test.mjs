import { fourthMemberTotals } from "../lib/fourth-season-contract.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createWarmRequest } from "../lib/warm-request.ts";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("개인 기능 warm GET은 재사용하고 만료·실패·초기화 후 다시 읽는다", async () => {
  let now = 0, calls = 0, fails = false;
  const cache = createWarmRequest(async () => { calls++; if (fails) throw new Error("offline"); return calls; }, 30_000, () => now);
  const first = cache.read(); assert.equal(cache.read(), first); assert.equal(await first, 1);
  assert.equal(cache.peek(), 1);
  now = 30_001; assert.equal(await cache.read(), 2);
  cache.clear(); fails = true; await assert.rejects(cache.read());
  fails = false; assert.equal(await cache.read(), 4);
  cache.set(8); assert.equal(await cache.read(), 8); assert.equal(calls, 4);
  assert.equal(cache.peek(), 8); cache.clear(); assert.equal(cache.peek(), undefined);
});
test("사용자별 warm cache는 분리되고 이전 요청 실패가 새 응답을 지우지 않는다", async () => {
  let reject;
  const firstOwner = createWarmRequest(() => new Promise((_, r) => { reject = r; }));
  const secondOwner = createWarmRequest(async () => "second");
  const stale = firstOwner.read(); firstOwner.set("new"); reject(new Error("old"));
  await assert.rejects(stale);
  assert.equal(await firstOwner.read(), "new"); assert.equal(await secondOwner.read(), "second");
});
test("첫 팝업은 지연 import 없이 준비되며 feature warm data를 넘긴다", () => {
  const dialog = read("components/my-activity-dialog.tsx");
  assert.match(dialog, /import Content from/); assert.doesNotMatch(dialog, /const Content = dynamic|visited &&/);
  assert.match(dialog, /showModal\(\)/);
  const area = read("components/fourth-dashboard-member-area.tsx");
  assert.match(area, /onOpenActivity\(kind, \{/);
  const content = read("components/my-activity-content.tsx");
  for (const prop of ["correctiveRequest", "timeMachineRequest", "giftStatus"]) assert.ok(content.includes(`featureSeed?.${prop}`));
  assert.match(content, /const FortuneView = readyViews\.Fortune \?\? Fortune/);
  assert.match(content, /const CorrectiveView = readyViews\.Corrective \?\? Corrective/);
  assert.match(content, /onSubmitted=\{\(\) => \{ void load\(true\)/);
});

function compileComponent(source, deps, exportName) {
  const clean = source.replace(/^import .*;$/gm, "").replace('"use client";', "");
  const compiled = ts.transpileModule(clean, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext } }).outputText.replace(/export default function /, "function ").replace(/export function /g, "function ");
  return new Function("React", ...Object.keys(deps), `${compiled}\nreturn ${exportName};`)(React, ...Object.values(deps));
}
test("수정 댓글은 수정 시각만, 원본 댓글은 작성 시각 하나만 렌더링한다", () => {
  const source = read("app/poc/hello-2027/hello-2027-guestbook.tsx");
  const part = source.slice(source.indexOf("function CommentTimestamp"), source.indexOf("function CommentEditor"));
  const Timestamp = compileComponent(part, { styles: {}, formatKoreanDateTime: value => value }, "CommentTimestamp");
  for (const updatedAt of [undefined, "2026-09-08T02:00:00Z", "bad", "2026-09-08T01:00:00Z"]) {
    const html = renderToStaticMarkup(React.createElement(Timestamp, { createdAt: "2026-09-08T01:00:00Z", updatedAt }));
    assert.equal((html.match(/<time /g) || []).length, 1);
    assert.equal(html.includes("수정"), updatedAt === "2026-09-08T02:00:00Z");
  }
  assert.match(source, /htmlFor="guestbook-body">내용<\/label>/);
});
test("활동 기록은 요약과 대기 거리·시간 캘린더 및 그래프를 제공한다", () => {
  let calendarProps;
  const Records = compileComponent(read("components/my-activity-records.tsx"), { useId: React.useId, useState: React.useState, fourthMemberTotals, styles: {}, MyActivityRecordChart: () => React.createElement("section", null, "기록 그래프"), ParticipantRecordCalendar: props => { calendarProps = props; return React.createElement("section", null, "calendar"); } }, "MyActivityRecords");
  const html = renderToStaticMarkup(React.createElement(Records, { data: {
    season: { today: "2026-10-08" }, summary: { official: { certifiedDays: 1, totalDistanceKm: 5, totalDurationSeconds: 1800 } },
    records: [{ date: "2026-10-08", distanceKm: 5.2, durationSeconds: 1930, status: "needs_review" }],
  } }));
  assert.doesNotMatch(html, /<h3>기록<\/h3>/); assert.equal((html.match(/총 인증일/g) || []).length, 1);
  assert.doesNotMatch(html, /선택 기간|제출 기록|그래프 항목|날짜별 누적/);
  assert.equal(calendarProps.showLegend, false); assert.equal(calendarProps.showTotal, false);
  assert.equal(calendarProps.records[0].distanceKm, 5.2); assert.equal(calendarProps.records[0].durationMinutes, 1930 / 60);
});
test("명언은 서로 다른 50개이며 길이·저자·원전 출처가 모두 있다", () => {
  assert.match(read("app/poc/hello-2027/hello-2027-poc.tsx"), /id="motivation-title">내던지는 명언 50선<\/span>/);
  const { quotes } = JSON.parse(read("lib/encouragement-quotes.json"));
  assert.equal(quotes.length, 50); assert.equal(new Set(quotes.map(q => q.text)).size, 50);
  for (const q of quotes) { assert.ok(q.reference && q.author); assert.ok(new URL(q.url).protocol === "https:"); assert.ok(`${q.text} — ${q.author}`.length <= 120); }
});

test("익명 체크박스는 미선택 시 본인 이름, 선택 시 익명으로 전환하며 등록 중 잠긴다", () => {
  const source = read("app/poc/hello-2027/hello-2027-guestbook.tsx");
  const Choice = compileComponent(source.slice(source.indexOf("function AnonymousChoice")), { styles: {} }, "AnonymousChoice");
  let mode;
  const element = Choice({ value: "kakao", onChange: value => { mode = value; } });
  const input = element.props.children[0];
  assert.equal(input.props.type, "checkbox"); assert.equal(input.props.checked, false);
  input.props.onChange({ target: { checked: true } }); assert.equal(mode, "anonymous");
  input.props.onChange({ target: { checked: false } }); assert.equal(mode, "kakao");
  const busy = Choice({ value: "anonymous", disabled: true, onChange() {} }).props.children[0];
  assert.equal(busy.props.checked, true); assert.equal(busy.props.disabled, true);
  assert.doesNotMatch(source, /AuthorModeChoice|댓글에 표시할 이름/);
  assert.match(source, /useState<AuthorMode>\("kakao"\)/);
  assert.match(source, /JSON\.stringify\(\{ body, author_mode: authorMode \}\)/);
  const footer = source.slice(source.indexOf("<div className={styles.composerActions}>"), source.indexOf("</form>", source.indexOf("<div className={styles.composerActions}>")));
  assert.match(footer, /<AnonymousChoice[\s\S]*댓글 남기기/);
});

test("멤버창은 인증일·거리·시간을 위에서 한 번만 보여주고 중복 안내는 제거한다", () => {
  const source = read("app/poc/hello-2027/hello-2027-poc.tsx");
  let calendarProps;
  const Dialog = compileComponent(source.slice(source.indexOf("function formatTotalDuration")), {
    fourthMemberTotals, styles: {}, ParticipantAvatar: () => null,
    ParticipantRecordCalendar: props => { calendarProps = props; return React.createElement("section", null, "calendar"); },
  }, "ParticipantDialog");
  for (const certifiedDays of [0, 8]) {
    const html = renderToStaticMarkup(React.createElement(Dialog, {
      participant: { fullName: "러너", id: "preview", certifiedDays, recordHistory: [], totalDistanceKm: 5.25, totalDurationMinutes: 85 },
      today: "2026-10-08", onClose() {},
    }));
    assert.equal((html.match(/총 인증일/g) || []).length, 1);
    assert.match(html, /총 인증일[\s\S]*누적 거리[\s\S]*누적 시간/);
    assert.doesNotMatch(html, /일째 인증 중|인증 기록|participant-dialog-description|확인 중|이번 주 승인 기록/);
    assert.equal(calendarProps.showTotal, false);
    assert.equal(calendarProps.showLegend, false); assert.equal(calendarProps.compact, true);
  }
  assert.doesNotMatch(read("app/poc/hello-2027/participant-record-calendar.tsx"), /4기 공식 인증 기준/);
  assert.doesNotMatch(read("app/poc/hello-2027/hello-2027-crew-banner.tsx"), />2026\.12\.31</);
  assert.match(source, /총 인증 거리[\s\S]*cumulativeTotals.distanceKm[\s\S]*총 인증 시간[\s\S]*cumulativeTotals.durationMinutes/);
  assert.match(source, /id="crew-title">멤버<\/h2>\s*<span className=\{styles.crewCount\}/);
});
