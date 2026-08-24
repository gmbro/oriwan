import { unstable_cache } from "next/cache";
import { buildPublicDashboardPayload, PUBLIC_DASHBOARD_CACHE_TAG } from "@/lib/public-dashboard-data";
import { buildSeasonReport, SEASON_REPORT_FROM, SEASON_REPORT_TO } from "@/lib/season-report";

const getCachedSeasonReportPayload = unstable_cache(
  () => buildPublicDashboardPayload(SEASON_REPORT_FROM, SEASON_REPORT_TO),
  ["season-report-payload-v2-anonymized-names", SEASON_REPORT_FROM, SEASON_REPORT_TO],
  {
    revalidate: 300,
    tags: [PUBLIC_DASHBOARD_CACHE_TAG],
  }
);

export async function getSeasonReport() {
  return buildSeasonReport(await getCachedSeasonReportPayload());
}
