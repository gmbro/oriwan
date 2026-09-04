import "server-only";

export function isFourthDashboardLive() {
  return process.env.FOURTH_DASHBOARD_LIVE === "true";
}
