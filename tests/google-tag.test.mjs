import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

test("Google Ads 태그를 루트 레이아웃에서 한 번 설정", () => {
  assert.match(layout, /const GOOGLE_TAG_ID = "AW-18451924880"/);
  assert.equal((layout.match(/googletagmanager\.com\/gtag\/js/g) ?? []).length, 1);
  assert.match(layout, /gtag\('config', '\$\{GOOGLE_TAG_ID\}'\)/);
  assert.match(layout, /strategy="afterInteractive"/);
});

test("보안 정책이 Google 태그 스크립트와 측정 요청을 허용", () => {
  assert.match(config, /script-src[^\n]+https:\/\/www\.googletagmanager\.com/);
  assert.match(config, /connect-src[^\n]+https:\/\/www\.google-analytics\.com/);
  assert.match(config, /connect-src[^\n]+https:\/\/googleads\.g\.doubleclick\.net/);
});
