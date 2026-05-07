import { createClient } from "@/lib/supabase/client";

export const DASHBOARD_REFRESH_CHANNEL = "snasa-dashboard-refresh";
export const DASHBOARD_REFRESH_EVENT = "records-updated";

function waitForSubscription(channel: ReturnType<ReturnType<typeof createClient>["channel"]>) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };

    const timeout = window.setTimeout(done, 1200);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        done();
      }
    });
  });
}

export async function broadcastDashboardRefresh() {
  if (typeof window === "undefined") return;

  const supabase = createClient();
  const channel = supabase.channel(DASHBOARD_REFRESH_CHANNEL, {
    config: { broadcast: { ack: false, self: false } },
  });

  try {
    await waitForSubscription(channel);
    await channel.send({
      type: "broadcast",
      event: DASHBOARD_REFRESH_EVENT,
      payload: { at: Date.now() },
    });
  } catch {
    // Realtime broadcast is a speed-up. Polling and DB subscriptions still keep the board correct.
  } finally {
    await supabase.removeChannel(channel);
  }
}
