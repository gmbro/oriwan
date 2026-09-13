import { createClient } from "@/lib/supabase/client";
import {
  DASHBOARD_REFRESH_CHANNEL,
  DASHBOARD_REFRESH_EVENT,
} from "@/lib/dashboard-refresh-contract";

export {
  DASHBOARD_REFRESH_CHANNEL,
  DASHBOARD_REFRESH_DOM_EVENT,
  DASHBOARD_REFRESH_EVENT,
} from "@/lib/dashboard-refresh-contract";

function waitForSubscription(channel: ReturnType<ReturnType<typeof createClient>["channel"]>) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (subscribed: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(subscribed);
    };

    const timeout = window.setTimeout(() => done(false), 1200);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") done(true);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") done(false);
    });
  });
}

type DashboardBroadcaster = {
  supabase: ReturnType<typeof createClient>;
  channel: ReturnType<ReturnType<typeof createClient>["channel"]>;
};

let broadcasterPromise: Promise<DashboardBroadcaster | null> | null = null;

function connectDashboardBroadcaster() {
  if (broadcasterPromise) return broadcasterPromise;

  broadcasterPromise = (async () => {
    const supabase = createClient();
    const channel = supabase.channel(DASHBOARD_REFRESH_CHANNEL, {
      config: { broadcast: { ack: false, self: false } },
    });
    const subscribed = await waitForSubscription(channel);
    if (!subscribed) {
      await supabase.removeChannel(channel);
      broadcasterPromise = null;
      return null;
    }
    return { supabase, channel };
  })().catch(() => {
    broadcasterPromise = null;
    return null;
  });

  return broadcasterPromise;
}

/** Warms the one reusable broadcast socket while the admin is reading the page. */
export function preconnectDashboardRefresh() {
  if (typeof window === "undefined") return;
  void connectDashboardBroadcaster();
}

export async function broadcastDashboardRefresh() {
  if (typeof window === "undefined") return;

  const broadcaster = await connectDashboardBroadcaster();
  if (!broadcaster) return;

  try {
    const status = await broadcaster.channel.send({
      type: "broadcast",
      event: DASHBOARD_REFRESH_EVENT,
      payload: { at: Date.now() },
    });
    if (status !== "ok") throw new Error("dashboard_broadcast_failed");
  } catch {
    // Drop a stale socket so the next mutation reconnects. Polling still keeps
    // the dashboard correct when Realtime is temporarily unavailable.
    broadcasterPromise = null;
    await broadcaster.supabase.removeChannel(broadcaster.channel);
  }
}
