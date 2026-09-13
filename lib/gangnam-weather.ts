/** One shared representative point in Gangnam-gu, never a member's location. */
export const GANGNAM_LOCATION = { latitude: 37.5172, longitude: 127.0473, name: "서울 강남구" } as const;
export const GANGNAM_WEATHER_API = "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=37.5172&lon=127.0473";
export const WEATHER_REFRESH_MS = 10 * 60_000;
export type BannerWeatherCondition = "clear" | "cloudy" | "fog" | "rain" | "snow";
export type GangnamWeather = {
  location: typeof GANGNAM_LOCATION.name;
  source: "MET Norway";
  kind: "forecast";
  condition: BannerWeatherCondition;
  temperatureC: number;
  forecastAt: string;
  updatedAt: string;
  validUntil: string;
  stale: boolean;
};

export const WEATHER_LABELS: Record<BannerWeatherCondition, string> = {
  clear: "맑음", cloudy: "구름 많음", fog: "안개", rain: "비", snow: "눈",
};

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function weatherCondition(symbol: string): BannerWeatherCondition | null {
  // Sleet is rendered as light precipitation, never as measured snow cover.
  if (symbol.includes("snow")) return "snow";
  if (symbol.includes("rain") || symbol.includes("sleet") || symbol.includes("thunder")) return "rain";
  if (symbol === "fog") return "fog";
  if (symbol.startsWith("cloudy") || symbol.startsWith("partlycloudy")) return "cloudy";
  if (symbol.startsWith("clearsky") || symbol.startsWith("fair")) return "clear";
  return null;
}

export function parseGangnamWeather(raw: unknown, now: number, stale = false): GangnamWeather | null {
  if (!Number.isFinite(now)) return null;
  const properties = object(object(raw).properties);
  const meta = object(properties.meta);
  const updatedAt = typeof meta.updated_at === "string" ? meta.updated_at : "";
  const updated = Date.parse(updatedAt);
  if (!Number.isFinite(updated) || updated > now + 15 * 60_000 || now - updated > 18 * 3_600_000) return null;
  if (object(meta.units).air_temperature !== "celsius") return null;
  if (!Array.isArray(properties.timeseries)) return null;
  // Choose the hour that contains now, not the first item in a cached forecast.
  const current = properties.timeseries.map(object)
    .filter(row => typeof row.time === "string" && Date.parse(row.time) <= now && now - Date.parse(row.time) < 90 * 60_000)
    .sort((a, b) => Date.parse(b.time as string) - Date.parse(a.time as string))[0];
  if (!current) return null;
  const data = object(current.data);
  const temperatureC = object(object(data.instant).details).air_temperature;
  const symbol = object(object(data.next_1_hours).summary).symbol_code;
  const condition = typeof symbol === "string" ? weatherCondition(symbol) : null;
  if (typeof temperatureC !== "number" || !Number.isFinite(temperatureC) || temperatureC < -70 || temperatureC > 60 || !condition) return null;
  return {
    location: GANGNAM_LOCATION.name, source: "MET Norway", kind: "forecast", condition,
    temperatureC: Math.round(temperatureC * 10) / 10,
    forecastAt: current.time as string, updatedAt,
    validUntil: new Date(Date.parse(current.time as string) + 90 * 60_000).toISOString(), stale,
  };
}

export function isGangnamWeather(value: unknown, now = Date.now()): value is GangnamWeather {
  const row = object(value);
  return row.location === GANGNAM_LOCATION.name && row.source === "MET Norway" && row.kind === "forecast"
    && typeof row.condition === "string" && Object.hasOwn(WEATHER_LABELS, row.condition)
    && typeof row.temperatureC === "number" && Number.isFinite(row.temperatureC) && row.temperatureC >= -70 && row.temperatureC <= 60
    && typeof row.forecastAt === "string" && Date.parse(row.forecastAt) <= now
    && typeof row.updatedAt === "string" && Number.isFinite(Date.parse(row.updatedAt))
    && now - Date.parse(row.updatedAt) <= 18 * 3_600_000 && Date.parse(row.updatedAt) <= now + 15 * 60_000
    && typeof row.validUntil === "string" && Date.parse(row.validUntil) > now
    && Date.parse(row.validUntil) <= Date.parse(row.forecastAt) + 90 * 60_000
    && typeof row.stale === "boolean";
}

export function getSeoulBannerPeriod(now = Date.now()) {
  const hour = new Date(now + 9 * 3_600_000).getUTCHours();
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}
