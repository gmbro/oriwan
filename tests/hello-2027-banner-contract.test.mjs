import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  DEFAULT_HELLO_2027_BANNER_CLICK_URL,
  isSafeHello2027BannerClickUrl,
  MAX_HELLO_2027_BANNER_CLICK_URL_LENGTH,
} from "../lib/hello-2027-banner-contract.ts";

test("배너 클릭 주소는 자격정보가 없는 HTTPS URL만 허용한다", () => {
  assert.equal(isSafeHello2027BannerClickUrl(DEFAULT_HELLO_2027_BANNER_CLICK_URL), true);
  assert.equal(isSafeHello2027BannerClickUrl("https://example.com/campaign?from=twtt#banner"), true);

  for (const value of [
    "http://example.com/",
    "javascript:alert(1)",
    "data:text/html,hello",
    "https://user:password@example.com/",
    "https://example.com/with space",
    "",
    null,
  ]) {
    assert.equal(isSafeHello2027BannerClickUrl(value), false, String(value));
  }
});

test("배너 클릭 주소는 저장 가능한 최대 길이를 넘지 않는다", () => {
  const tooLong = `https://example.com/${"a".repeat(MAX_HELLO_2027_BANNER_CLICK_URL_LENGTH)}`;
  assert.equal(isSafeHello2027BannerClickUrl(tooLong), false);
});

test("배너 하단 넘김 영역 없이 화살표·스와이프·14초 전환·일시정지는 유지한다", () => {
  const source = readFileSync(new URL("../app/poc/hello-2027/hello-2027-banner-carousel.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/poc/hello-2027/hello-2027-poc.module.css", import.meta.url), "utf8");
  assert.doesNotMatch(source + css, /carouselFooter|carouselDots|배너 선택/);
  assert.match(source, /AUTO_ADVANCE_MS = 14_000/);
  assert.match(source, /aria-label="이전 배너"/);
  assert.match(source, /aria-label="다음 배너"/);
  assert.match(source, /배너 움직임과 자동 전환 일시정지/);
  assert.match(css, /scroll-snap-type: x mandatory/);
  assert.match(css, /\.carouselArrow\s*\{[^}]*top: 50%/);
});

test("대시보드 날씨 푸터는 없애고 출처와 라이선스는 안내 페이지로 옮긴다", () => {
  const dashboard = readFileSync(new URL("../app/poc/hello-2027/hello-2027-poc.tsx", import.meta.url), "utf8");
  const terms = readFileSync(new URL("../app/terms/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(dashboard, /<footer|날씨 예보를 단순화한 배너 연출|MET Norway|CC BY/);
  assert.match(terms, /id="weather-data"/);
  assert.match(terms, /MET Norway/);
  assert.match(terms, /https:\/\/creativecommons.org\/licenses\/by\/4.0\//);
});
