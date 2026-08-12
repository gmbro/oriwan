"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DASHBOARD_REFRESH_CHANNEL, DASHBOARD_REFRESH_EVENT } from "@/lib/dashboard-refresh";
import { createClient } from "@/lib/supabase/client";

const SEASON_REPORT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function SeasonReportAutoRefresh() {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    lastRefreshAtRef.current = Date.now();

    const refreshIfDue = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAtRef.current < SEASON_REPORT_REFRESH_INTERVAL_MS) return;

      lastRefreshAtRef.current = Date.now();
      router.refresh();
    };

    const interval = window.setInterval(refreshIfDue, SEASON_REPORT_REFRESH_INTERVAL_MS);
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
          router.refresh();
        })
        .subscribe();
    } catch {
      // The five-minute refresh remains the fallback when realtime is unavailable.
    }

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfDue);
      document.removeEventListener("visibilitychange", refreshIfDue);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
