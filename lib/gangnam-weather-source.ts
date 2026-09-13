import { GANGNAM_WEATHER_API, parseGangnamWeather } from "./gangnam-weather";

/** Server-side cache. CDN caching in the route additionally shares responses.
 * Never forward cookies, personal coordinates, or a user's IP to the provider. */
export function createGangnamWeatherSource(fetcher: typeof fetch = fetch, clock = Date.now) {
  let cached: unknown = null;
  let expiresAt = 0;
  let retryAt = 0;
  let lastModified = "";
  let failed = false;
  let pending: Promise<void> | null = null;
  const refresh = async () => {
    try {
      const headers: Record<string, string> = {
        "User-Agent": "TWTT/1.0 (+https://xn--220bw61afob.kro.kr)",
        Accept: "application/json",
      };
      if (lastModified) headers["If-Modified-Since"] = lastModified;
      const response = await fetcher(GANGNAM_WEATHER_API, { headers, cache: "no-store", signal: AbortSignal.timeout(3500) });
      if (response.status !== 304 && !response.ok) {
        const retry = response.headers.get("retry-after");
        const retryMs = retry && /^\d+$/.test(retry) ? clock() + Number(retry) * 1000 : Date.parse(retry || "");
        // Back off on failures/rate limits; no per-user retry storm.
        retryAt = Math.max(clock() + 10 * 60_000, Number.isFinite(retryMs) ? retryMs : 0);
        throw new Error("Weather provider unavailable");
      }
      if (response.status === 304) {
        if (!cached) throw new Error("Weather cache unavailable");
      } else {
        const raw: unknown = await response.json();
        if (!parseGangnamWeather(raw, clock())) throw new Error("Weather response invalid or outdated");
        cached = raw;
        lastModified = response.headers.get("last-modified") || "";
      }
      const providerExpires = Date.parse(response.headers.get("expires") || "");
      expiresAt = Math.max(clock() + 60 * 60_000, Number.isFinite(providerExpires) ? providerExpires : 0);
      failed = false;
    } catch {
      failed = true;
      retryAt = Math.max(retryAt, clock() + 10 * 60_000);
    }
  };
  return async () => {
    if (clock() >= expiresAt && clock() >= retryAt) {
      if (!pending) pending = refresh().finally(() => { pending = null; });
      await pending;
    }
    return parseGangnamWeather(cached, clock(), failed);
  };
}
