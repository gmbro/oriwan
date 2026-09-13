import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { GANGNAM_LOCATION, GANGNAM_WEATHER_API, getSeoulBannerPeriod, isGangnamWeather, parseGangnamWeather, weatherCondition } from "../lib/gangnam-weather.ts";

// Test the server cache with an injected fetch/clock, without contacting a provider.
const source = readFileSync(new URL("../lib/gangnam-weather-source.ts", import.meta.url), "utf8")
  .replace('"./gangnam-weather"', JSON.stringify(new URL("../lib/gangnam-weather.ts", import.meta.url).href));
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createGangnamWeatherSource } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const start = Date.parse("2026-09-08T05:00:00Z");
function forecast(now = start, symbol = "partlycloudy_day") {
  return { properties: {
    meta: { updated_at: new Date(now).toISOString(), units: { air_temperature: "celsius" } },
    timeseries: Array.from({ length: 8 }, (_, i) => ({
      time: new Date(now + i * 3_600_000).toISOString(),
      data: { instant: { details: { air_temperature: 28.8 - i } }, next_1_hours: { summary: { symbol_code: symbol } } },
    })),
  } };
}

test("모든 사용자는 강남구 고정 좌표를 공유하며 현재 시간의 예보를 선택한다", () => {
  assert.deepEqual(GANGNAM_LOCATION, { latitude: 37.5172, longitude: 127.0473, name: "서울 강남구" });
  assert.match(GANGNAM_WEATHER_API, /lat=37\.5172&lon=127\.0473$/);
  const weather = parseGangnamWeather(forecast(), start + 3_900_000);
  assert.equal(weather.temperatureC, 27.8);
  assert.equal(weather.forecastAt, "2026-09-08T06:00:00.000Z");
  assert.equal(weather.kind, "forecast");
  assert.ok(isGangnamWeather(weather, start + 3_900_000));
});

test("강수 코드를 눈·비로 구분하고 천둥도 번쩍임 없이 비로 단순화한다", () => {
  for (const [code, expected] of [["clearsky_day", "clear"], ["fair_night", "clear"], ["cloudy", "cloudy"], ["partlycloudy_night", "cloudy"], ["fog", "fog"], ["heavyrainandthunder", "rain"], ["sleet", "rain"], ["lightssnowshowersandthunder_day", "snow"]]) assert.equal(weatherCondition(code), expected);
  assert.equal(weatherCondition("invalid"), null);
});

test("오래됐거나 불완전한 응답을 현재 날씨로 표시하지 않는다", () => {
  assert.equal(parseGangnamWeather(null, start), null);
  assert.equal(parseGangnamWeather(forecast(), start + 24 * 3_600_000), null);
  assert.equal(parseGangnamWeather(forecast(), start - 3_600_000), null);
  assert.equal(parseGangnamWeather(forecast(start, "unrecognized"), start), null);
  const badUnit = forecast(); badUnit.properties.meta.units.air_temperature = "fahrenheit";
  assert.equal(parseGangnamWeather(badUnit, start), null);
  const badValue = forecast(); badValue.properties.timeseries[0].data.instant.details.air_temperature = null;
  assert.equal(parseGangnamWeather(badValue, start), null);
  const valid = parseGangnamWeather(forecast(), start);
  assert.equal(isGangnamWeather(valid, start + 90 * 60_000), false);
  assert.equal(isGangnamWeather({ ...valid, condition: "constructor" }, start), false);
  assert.equal(isGangnamWeather({ ...valid, location: "부산" }, start), false);
});

test("서울 시각은 서버/기기 시간대에 의존하지 않는다", () => {
  for (const [utc, expected] of [["20:00", "morning"], ["01:00", "day"], ["08:00", "evening"], ["12:00", "night"]]) assert.equal(getSeoulBannerPeriod(Date.parse(`2026-09-08T${utc}:00Z`)), expected);
});

test("공통 서버 캐시는 동시 요청을 합치고 Expires 및 조건부 요청을 준수한다", async () => {
  let now = start, calls = 0;
  const modified = new Date(start).toUTCString();
  const get = createGangnamWeatherSource(async (url, options) => {
    assert.equal(url, GANGNAM_WEATHER_API);
    assert.match(options.headers["User-Agent"], /^TWTT/);
    assert.equal(options.headers.Cookie, undefined);
    calls++;
    if (calls === 1) return new Response(JSON.stringify(forecast()), { headers: { Expires: new Date(start + 2 * 3_600_000).toUTCString(), "Last-Modified": modified } });
    assert.equal(options.headers["If-Modified-Since"], modified);
    return new Response(null, { status: 304 });
  }, () => now);
  const batch = await Promise.all(Array.from({ length: 10 }, () => get()));
  assert.equal(calls, 1);
  assert.ok(batch.every(Boolean));
  now += 90 * 60_000;
  assert.equal((await get()).temperatureC, 27.8);
  assert.equal(calls, 1, "provider Expires 이전에는 재조회하지 않음");
  now = start + 2 * 3_600_000;
  assert.equal((await get()).temperatureC, 26.8);
  assert.equal(calls, 2);
});

test("제공자 실패는 제한된 이전 예보로 내려가며 Retry-After를 지킨다", async () => {
  let now = start, calls = 0;
  const get = createGangnamWeatherSource(async () => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify(forecast()));
    return new Response(null, { status: 429, headers: { "Retry-After": "7200" } });
  }, () => now);
  assert.equal((await get()).stale, false);
  now += 3_600_000;
  assert.equal((await get()).stale, true);
  assert.equal(calls, 2);
  now += 3_600_000;
  assert.equal((await get()).stale, true);
  assert.equal(calls, 2);
  now = start + 24 * 3_600_000;
  assert.equal(await get(), null);
});

test("첫 날씨 조회 실패도 예외를 화면으로 전파하거나 맑음으로 위장하지 않는다", async () => {
  let calls = 0;
  const get = createGangnamWeatherSource(async () => { calls++; throw new Error("timeout"); }, () => start);
  assert.equal(await get(), null);
  assert.equal(await get(), null);
  assert.equal(calls, 1);
});

test("배너에는 응원 문구가 없고 날씨 모션은 최대 열 개의 CSS 입자다", () => {
  const banner = readFileSync(new URL("../app/poc/hello-2027/hello-2027-crew-banner.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/poc/hello-2027/hello-2027-crew-banner.module.css", import.meta.url), "utf8");
  assert.doesNotMatch(banner, /stats\.message/);
  assert.match(banner, /\[8, 19, 31, 43, 52, 63, 74, 82, 91, 97\]/);
  assert.match(css, /data-running="true"\]\s+\.weatherParticle/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
