import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getRecordMonthDays, shiftRecordMonth } from "../lib/participant-record-calendar.ts";
import { getSafeAuthReturnPath, getSafeAuthReturnUrl } from "../lib/auth-return-path.ts";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function compile(path, name, dependencies) {
  const source = read(path).replace(/^import .*;$/gm, "");
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/\bexport /g, "");
  return new Function("React", ...Object.keys(dependencies), `${js}\nreturn ${name};`)(React, ...Object.values(dependencies));
}

function dialogHarness(hash = "", navigationType = "navigate") {
  const listeners = new Map(); const effects = []; const replacements = []; let opened = 0;
  const location = { hash, pathname: "/4th/dashboard", search: "?view=test" };
  const history = { state: { __NA: true }, replaceState(state, title, url) { replacements.push({ state, title, url }); location.hash = ""; } };
  let refIndex = 0;
  const Dialog = compile("components/my-activity-dialog.tsx", "MyActivityDialog", {
    window: { location, history, performance: { getEntriesByType: () => [{ type: navigationType }] }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    document: { activeElement: null }, HTMLElement: class {},
    requestAnimationFrame: fn => fn(),
    useEffect: fn => effects.push(fn), useLayoutEffect: fn => effects.push(fn), useState: value => [value, () => {}],
    useRef: () => ({ current: refIndex++ === 0 ? { open: false, showModal() { opened++; this.open = true; } } : null }),
    styles: {}, Content: () => null, usePageScrollLock: () => {},
  });
  Dialog({ name: "테스트" }); const cleanup = effects[0]();
  return { listeners, replacements, location, history, cleanup, opened: () => opened };
}

test("로그인 버튼은 대시보드로 복귀하고 명시적인 개인창 링크만 보존한다", () => {
  for (const hash of ["", "#my-activity", "#member-features"]) {
    assert.equal(getSafeAuthReturnPath(`/4th/dashboard${hash}`), `/4th/dashboard${hash}`);
    assert.equal(getSafeAuthReturnUrl(`/4th/dashboard${hash}`, "https://example.com").href, `https://example.com/4th/dashboard${hash}`);
  }
  for (const file of ["components/dashboard-gateway-actions.tsx", "app/poc/hello-2027/hello-2027-poc.tsx"]) {
    assert.match(read(file), /nextPath="\/4th\/dashboard"/);
  }
  for (const file of ["app/4th/page.tsx", "app/api/auth/kakao/route.ts", "app/api/auth/callback/route.ts"]) assert.doesNotMatch(read(file), /\/4th\/dashboard#member-features/);
});

test("내 정보 직접 링크는 한 번 열고 주소를 정리하며 새로고침에서는 열지 않는다", () => {
  for (const hash of ["#my-activity", "#member-features"]) {
    const direct = dialogHarness(hash); assert.equal(direct.opened(), 1); assert.equal(direct.location.hash, "");
    assert.deepEqual(direct.replacements, [{ state: direct.history.state, title: "", url: "/4th/dashboard?view=test" }]);
    const reload = dialogHarness(hash, "reload"); assert.equal(reload.opened(), 0); assert.equal(reload.location.hash, "");
  }
  for (const hash of ["", "#top", "#guestbook"]) {
    const h = dialogHarness(hash, "reload"); assert.equal(h.opened(), 0); assert.deepEqual(h.replacements, []);
    h.listeners.get("twtt:my-activity")(new CustomEvent("twtt:my-activity", { detail: { section: "profile" } }));
    assert.equal(h.opened(), 1); h.cleanup(); assert.equal(h.listeners.size, 0);
  }
  const h = dialogHarness("", "reload"); h.location.hash = "#my-activity"; h.listeners.get("hashchange")();
  assert.equal(h.opened(), 1); assert.equal(h.location.hash, "");
});

test("확인 중 문구를 지워도 검수 대기 기록의 거리·시간은 캘린더에 남긴다", () => {
  const Calendar = compile("app/poc/hello-2027/participant-record-calendar.tsx", "ParticipantRecordCalendar", {
    useId: () => "calendar", useMemo: fn => fn(), useState: initial => [initial, () => {}], styles: {}, getRecordMonthDays, shiftRecordMonth,
  });
  const html = renderToStaticMarkup(React.createElement(Calendar, { today: "2026-08-31", certifiedDays: 0, showLegend: false, showTotal: false, compact: true,
    records: [{ recordDateIso: "2026-08-31", distanceKm: 5.24, durationMinutes: 32, status: "needs_review" }],
  }));
  assert.doesNotMatch(html, /확인 중|자기소개|인증 완료/);
  assert.match(html, /운동 기록, 5.24km, 32분/); assert.match(html, /data-compact="true"/);
  assert.equal((html.match(/aria-pressed=/g) || []).length, 31);
});

test("헤더 글꼴은 동일한 부모 스타일을 상속하고 멤버창은 높이·가로모드에 대응한다", () => {
  const css = read("app/poc/hello-2027/hello-2027-poc.module.css");
  assert.match(css, /\.headerDateTime > span\s*\{[^}]*color: inherit; font: inherit;/);
  assert.match(css, /\.headerMeta \.headerDateTime\s*\{[^}]*white-space: nowrap/);
  assert.match(css, /min-width: 560px\) and \(max-height: 540px/);
  assert.match(css, /max-height: calc\(100dvh - 24px\)/);
  assert.match(read("app/poc/hello-2027/participant-record-calendar.module.css"), /\.section\[data-compact\] \.day \{ height: 24px/);
});
