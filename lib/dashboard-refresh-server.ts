import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DASHBOARD_REFRESH_CHANNEL,
  DASHBOARD_REFRESH_EVENT,
} from "@/lib/dashboard-refresh-contract";

/** Best-effort invalidation hint for dashboards already open in a browser. */
export async function broadcastDashboardRefreshFromServer(service: SupabaseClient) {
  const channel = service.channel(DASHBOARD_REFRESH_CHANNEL, {
    config: { broadcast: { ack: false, self: false } },
  });

  try {
    // Serverless mutations only publish a hint; opening a WebSocket and
    // subscribing first adds a needless handshake and server lifetime.
    const result = await channel.httpSend(
      DASHBOARD_REFRESH_EVENT,
      { at: Date.now() },
      { timeout: 2_000 },
    );
    return result.success;
  } catch {
    return false;
  } finally {
    await service.removeChannel(channel).catch(() => undefined);
  }
}
