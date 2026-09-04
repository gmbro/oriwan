import snapshot from "@/data/third-season-public-dashboard.json";
import type { PublicDashboardPayload } from "@/lib/public-dashboard-data";
import { buildSeasonReport } from "@/lib/season-report";

export const thirdSeasonSnapshot = snapshot as unknown as PublicDashboardPayload;
export const thirdSeasonReport = buildSeasonReport(thirdSeasonSnapshot);
