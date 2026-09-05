"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DASHBOARD_REFRESH_CHANNEL,
  DASHBOARD_REFRESH_DOM_EVENT,
  DASHBOARD_REFRESH_EVENT,
} from "@/lib/dashboard-refresh";
import { createClient } from "@/lib/supabase/client";

const SEASON_REPORT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function SeasonReportAutoRefresh({ intervalMs = SEASON_REPORT_REFRESH_INTERVAL_MS }: { intervalMs?: number } = {}) {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    lastRefreshAtRef.current = Date.now();

    const refreshDashboard = () => {
      window.dispatchEvent(new Event(DASHBOARD_REFRESH_DOM_EVENT));
      router.refresh();
    };

    const refreshIfDue = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAtRef.current < intervalMs) return;

      lastRefreshAtRef.current = Date.now();
      refreshDashboard();
    };

    const interval = window.setInterval(refreshIfDue, intervalMs);
    window.addEventListener("focus", refreshIfDue);
    document.addEventListener("visibilitychange", refreshIfDue);

    let supabase: ReturnType<typeof createClient> | null = null;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      supabase = createClient();
      channel = supabase
        .channel(DASHBOARD_REFRESH_CHANNEL)
        .on("broadcast", { event: DASHBOARD_REFRESH_EVENT }, () => {
          lastRefreshAtRef.current = Date.now();
          refreshDashboard();
        })
        .subscribe();
    } catch {
      // The configured interval remains the fallback when realtime is unavailable.
    }

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfDue);
      document.removeEventListener("visibilitychange", refreshIfDue);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [intervalMs, router]);

  return null;
}
