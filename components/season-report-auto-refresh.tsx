"use client";

import { useEffect, useRef } from "react";
import {
  DASHBOARD_REFRESH_CHANNEL,
  DASHBOARD_REFRESH_DOM_EVENT,
  DASHBOARD_REFRESH_EVENT,
  DASHBOARD_SNAPSHOT_DOM_EVENT,
} from "@/lib/dashboard-refresh-contract";
import type { Hello2027Snapshot } from "@/lib/hello-2027-types";

const SEASON_REPORT_REFRESH_INTERVAL_MS = 90 * 1000;
const REALTIME_REFRESH_DEBOUNCE_MS = 80;
// A public broadcast is only a hint. Coalesce repeated/untrusted hints so each
// browser performs at most one projection read per second.
const MIN_REFRESH_GAP_MS = 1_000;

export function SeasonReportAutoRefresh({ intervalMs = SEASON_REPORT_REFRESH_INTERVAL_MS }: { intervalMs?: number } = {}) {
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    let dirtyWhileHidden = false;
    let refreshInFlight = false;
    let refreshQueued = false;
    const controller = new AbortController();
    lastRefreshAtRef.current = Date.now();

    const refreshDashboard = async () => {
      if (!active) return;
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }
      refreshInFlight = true;
      lastRefreshAtRef.current = Date.now();
      // Independent panels should start together, not wait for every member
      // metric/profile image query before comments and content may refresh.
      window.dispatchEvent(new Event(DASHBOARD_REFRESH_DOM_EVENT));
      try {
        const response = await fetch("/api/public/hello-2027/dashboard", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const snapshot = await response.json().catch(() => null) as Hello2027Snapshot | null;
        if (active && response.ok && snapshot && Array.isArray(snapshot.participants)) {
          // Update only the public report state. A full router.refresh also
          // re-ran Kakao auth and reconciled every client island, which made an
          // unrelated dialog click compete with background certification sync.
          window.dispatchEvent(new CustomEvent(DASHBOARD_SNAPSHOT_DOM_EVENT, { detail: snapshot }));
        }
      } catch {
        // The interval/focus fallback retries after transient network failures.
      } finally {
        refreshInFlight = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          scheduleRefresh(REALTIME_REFRESH_DEBOUNCE_MS);
        }
      }
    };

    const scheduleRefresh = (minimumDelay = 0) => {
      if (!active || refreshTimer !== null) return;
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }
      if (document.visibilityState !== "visible") {
        dirtyWhileHidden = true;
        return;
      }
      const elapsed = Date.now() - lastRefreshAtRef.current;
      const delay = Math.max(minimumDelay, MIN_REFRESH_GAP_MS - elapsed, 0);
      refreshTimer = globalThis.setTimeout(() => {
        refreshTimer = null;
        void refreshDashboard();
      }, delay);
    };

    const refreshIfDue = () => {
      if (document.visibilityState !== "visible") return;
      if (dirtyWhileHidden) {
        dirtyWhileHidden = false;
        scheduleRefresh();
        return;
      }
      if (Date.now() - lastRefreshAtRef.current < intervalMs) return;
      scheduleRefresh();
    };

    const interval = window.setInterval(refreshIfDue, intervalMs);
    window.addEventListener("focus", refreshIfDue);
    document.addEventListener("visibilitychange", refreshIfDue);

    type SupabaseBrowserClient = ReturnType<typeof import("@/lib/supabase/client")["createClient"]>;
    let supabase: SupabaseBrowserClient | null = null;
    let channel: ReturnType<SupabaseBrowserClient["channel"]> | null = null;
    let connectTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

    const connectRealtime = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        if (!active) return;
        supabase = createClient();
        channel = supabase
          .channel(DASHBOARD_REFRESH_CHANNEL)
          .on("broadcast", { event: DASHBOARD_REFRESH_EVENT }, () => {
            // Record imports can emit several closely spaced mutations. One
            // refresh after the burst contains every committed change.
            scheduleRefresh(REALTIME_REFRESH_DEBOUNCE_MS);
          })
          .subscribe();
      } catch {
        // The configured interval remains the fallback when realtime is unavailable.
      }
    };

    // Open the lightweight broadcast listener just after first paint so a certification
    // can reach an already-open public dashboard without waiting for the old idle window.
    connectTimer = globalThis.setTimeout(() => void connectRealtime(), 0);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      if (refreshTimer !== null) globalThis.clearTimeout(refreshTimer);
      if (connectTimer !== null) globalThis.clearTimeout(connectTimer);
      window.removeEventListener("focus", refreshIfDue);
      document.removeEventListener("visibilitychange", refreshIfDue);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [intervalMs]);

  return null;
}
