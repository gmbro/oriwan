import { SeasonReportAutoRefresh } from "@/components/season-report-auto-refresh";

export default function SeasonReportLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SeasonReportAutoRefresh />
      {children}
    </>
  );
}
