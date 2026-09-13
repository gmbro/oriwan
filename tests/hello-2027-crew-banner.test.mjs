import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getCrewBannerStats, getCrewBannerPeriod, getCrewRunnerCount, HEALING_BANNER_IMAGE, HEALING_RUNNER_ATLASES, HELLO_2027_CREW_BANNER_IMAGE } from "../lib/hello-2027-crew-banner.ts";
import sharp from "sharp";
import { getHealingRoutePoint, healingRouteTransform, HEALING_RUNNERS, HEALING_RUNNER_ROUTE, HEALING_STRIDE_SECONDS, HEALING_TRAVEL_SECONDS } from "../lib/healing-runner-route.ts";

test("인증률과 인원 설명은 같은 실제 집계에서 계산한다", () => {
  const stats = getCrewBannerStats(17, 25);
  assert.equal(stats.rate, 68);
  assert.equal(stats.description, "25명 중 17명이 인증했어요");
  assert.equal(getCrewBannerStats(1, 3).rate, 33);
});

test("아직 멤버나 인증이 없을 때 0%로 안전하게 표시한다", () => {
  assert.equal(getCrewBannerStats(0, 0).rate, 0);
  assert.equal(getCrewBannerStats(0, 5).description, "5명 중 0명이 인증했어요");
  assert.equal(getCrewBannerStats(0, 5).message, "오늘의 첫 걸음을 기다려요.");
});

test("100% 안내는 반올림 값이 아니라 실제 전원 인증일 때만 표시한다", () => {
  assert.equal(getCrewBannerStats(5, 5).message, "오늘은 모두 함께 해냈어요!");
  assert.notEqual(getCrewBannerStats(999, 1000).message, "오늘은 모두 함께 해냈어요!");
});

test("잘못된 집계가 진행 막대 범위를 벗어나지 않는다", () => {
  assert.equal(getCrewBannerStats(100, 5).rate, 100);
  assert.equal(getCrewBannerStats(-1, 5).rate, 0);
  assert.equal(getCrewBannerStats(NaN, Infinity).rate, 0);
});

test("최종 배경은 프로젝트의 실제 WebP 파일로 제공한다", () => {
  const file = readFileSync(new URL(`../public${HELLO_2027_CREW_BANNER_IMAGE}`, import.meta.url));
  assert.equal(file.subarray(0, 4).toString(), "RIFF");
  assert.equal(file.subarray(8, 12).toString(), "WEBP");
  assert.ok(file.byteLength < 300_000, "웹 배너는 300KB 미만");
});

test("서울 시간대의 여섯 구간을 네 가지 부드러운 색감으로 연결한다", () => {
  assert.equal(getCrewBannerPeriod("dawn"), "morning");
  assert.equal(getCrewBannerPeriod("morning"), "morning");
  assert.equal(getCrewBannerPeriod("day"), "day");
  assert.equal(getCrewBannerPeriod("sunset"), "evening");
  assert.equal(getCrewBannerPeriod("evening"), "evening");
  assert.equal(getCrewBannerPeriod("night"), "night");
  assert.equal(getCrewBannerPeriod("unknown"), "day");
});

test("실제 인증 비율에 따라 러너가 0~5명 등장한다", () => {
  for (const [completed, expected] of [[0, 0], [1, 1], [20, 1], [21, 2], [40, 2], [41, 3], [60, 3], [61, 4], [80, 4], [81, 5], [100, 5]]) {
    assert.equal(getCrewRunnerCount(completed, 100), expected);
  }
  assert.equal(getCrewRunnerCount(999, 0), 0);
  assert.equal(getCrewRunnerCount(NaN, Infinity), 0);
  assert.equal(getCrewRunnerCount(-3, 4), 0);
  assert.equal(getCrewRunnerCount(10, 4), 5);
});

test("인증 인원 변경은 이미지를 유지해 페이드하며 최초 0%는 러너를 요청하지 않는다", () => {
  const component = readFileSync(new URL("../app/poc/hello-2027/hello-2027-crew-banner.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/poc/hello-2027/hello-2027-crew-banner.module.css", import.meta.url), "utf8");
  assert.match(component, /useState\(count\)/);
  assert.match(component, /i < Math\.max\(count, loadedRunnerCount\)/);
  assert.match(css, /opacity 1\.8s ease-in-out/);
  assert.match(css, /visibility 0s linear 1\.8s/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("배경과 독립 8프레임 두 종류의 전체 용량은 250KB 미만이다", async () => {
  const paths = [HEALING_BANNER_IMAGE, ...HEALING_RUNNER_ATLASES, ...["a", "b"].map(type => `/images/poc/hello-2027/healing/runner-${type}-still.webp`)];
  let bytes = 0;
  for (const path of paths) {
    const file = readFileSync(new URL(`../public${path}`, import.meta.url));
    bytes += file.byteLength;
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.format, "webp");
    if (path.includes("-8.webp")) {
      assert.equal(metadata.width, 1536);
      assert.equal(metadata.height, 256);
      const frames = await Promise.all(Array.from({ length: 8 }, (_, i) => sharp(file).extract({ left: i * 192, top: 0, width: 192, height: 256 }).raw().toBuffer()));
      assert.equal(new Set(frames.map(frame => frame.toString("base64"))).size, 8, "서로 다른 여덟 포즈");
    }
    if (path.includes("-still.webp")) { assert.equal(metadata.width, 192); assert.equal(metadata.height, 256); }
  }
  assert.ok(bytes < 250_000, `asset budget: ${bytes}`);
});

test("발걸음은 절반 속도이며 이동은 한 프레임당 React 갱신 없이 64초 주기다", () => {
  assert.equal(HEALING_STRIDE_SECONDS, 2.4);
  assert.equal(HEALING_TRAVEL_SECONDS, 64);
  assert.equal(HEALING_RUNNERS.length, 5);
  assert.equal(new Set(HEALING_RUNNERS.map(runner => runner.travelDelay)).size, 5);
});

test("경로 전체와 정지 위치는 원본 이미지의 회색길 안쪽에 있다", () => {
  // Conservative grey-lane bounds traced along both white borders. Percent
  // coordinates make the same check valid after any uniform cover transform.
  const lane = [
    { y: 61.9, left: 73.8, right: 78 },
    { y: 63.4, left: 76.5, right: 81.3 },
    { y: 65.2, left: 78.8, right: 84 },
    { y: 68, left: 78, right: 85 },
    { y: 73, left: 75, right: 85 },
    { y: 80.5, left: 69.5, right: 84.5 },
    { y: 89, left: 62.5, right: 84.5 },
    { y: 98, left: 55, right: 85 },
  ];
  let previous = getHealingRoutePoint(0);
  for (let progress = 0; progress <= 100; progress += .25) {
    const point = getHealingRoutePoint(progress);
    const index = Math.max(1, lane.findIndex(bound => bound.y >= point.y));
    const lower = lane[index - 1], upper = lane[index];
    const ratio = (point.y - lower.y) / (upper.y - lower.y);
    const left = lower.left + (upper.left - lower.left) * ratio;
    const right = lower.right + (upper.right - lower.right) * ratio;
    const stance = 2 * point.scale;
    assert.ok(point.x - stance > left && point.x + stance < right, `outside road at ${progress}%`);
    assert.ok(point.y <= previous.y && point.scale <= previous.scale, "멀어질수록 위로 이동하고 작아짐");
    previous = point;
  }
  for (const runner of HEALING_RUNNERS) {
    const rest = getHealingRoutePoint(-runner.travelDelay / HEALING_TRAVEL_SECONDS * 100);
    assert.ok(rest.scale > 0 && rest.scale <= 1);
    assert.match(healingRouteTransform(rest), /cqi - 50%/);
    assert.match(healingRouteTransform(rest), /cqb - 86%/);
  }
  assert.deepEqual(getHealingRoutePoint(NaN), getHealingRoutePoint(0));
  assert.deepEqual(getHealingRoutePoint(-1), getHealingRoutePoint(0));
  assert.deepEqual(getHealingRoutePoint(101), getHealingRoutePoint(100));
  assert.equal(HEALING_RUNNER_ROUTE.at(-1).at, 100);
});
