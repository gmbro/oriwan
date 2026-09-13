"use client";

import { useEffect, useRef, useState } from "react";
import { isGangnamWeather, WEATHER_REFRESH_MS, type GangnamWeather } from "@/lib/gangnam-weather";

export function useGangnamWeather(active: boolean) {
  const [weather, setWeather] = useState<GangnamWeather | null>(null);
  const lastAttempt = useRef(0);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let controller: AbortController | null = null;
    let timeout = 0;
    const load = async () => {
      if (document.hidden || cancelled) return;
      setWeather(previous => previous && isGangnamWeather(previous) ? previous : null);
      if (Date.now() - lastAttempt.current < WEATHER_REFRESH_MS) return;
      lastAttempt.current = Date.now();
      controller = new AbortController();
      timeout = window.setTimeout(() => controller?.abort(), 5000);
      try {
        const response = await fetch("/api/public/gangnam-weather", { credentials: "omit", signal: controller.signal, priority: "low" });
        if (!response.ok) return;
        const body: unknown = await response.json();
        const value = body && typeof body === "object" && "weather" in body ? body.weather : null;
        if (!cancelled && isGangnamWeather(value)) setWeather(value);
      } catch { /* Weather must never block the dashboard or open an error modal. */ }
      finally { window.clearTimeout(timeout); controller = null; }
    };
    // Background image and the usable page take priority over optional weather.
    const initial = window.setTimeout(() => { void load(); }, 700);
    const interval = window.setInterval(() => { void load(); }, WEATHER_REFRESH_MS);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (controller) { lastAttempt.current = 0; controller.abort(); }
      window.clearTimeout(initial); window.clearTimeout(timeout); window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);
  return weather && isGangnamWeather(weather) ? weather : null;
}
