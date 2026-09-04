import { notFound } from "next/navigation";

import { PersonalSeasonReport } from "@/components/personal-season-report";
import { thirdSeasonReport } from "@/lib/third-season-snapshot";

const THIRD_SEASON_REPORT_PATH = "/dashboard/report/3th";

export async function generateMetadata({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  const member = thirdSeasonReport.members.find((item) => item.id === participantId);

  return {
    title: member ? `${member.name}님의 TWTT 3기 리포트 | TWTT 러닝보드` : "TWTT 3기 리포트 | TWTT 러닝보드",
    description: member?.statement || "TWTT 3기 크루의 개인 100일 러닝 기록",
  };
}

export default async function ThirdSeasonParticipantReportPage({
  params,
}: {
  params: Promise<{ participantId: string }>;
}) {
  const { participantId } = await params;
  const member = thirdSeasonReport.members.find((item) => item.id === participantId);
  if (!member) notFound();

  const reportMember = {
    id: member.id,
    name: member.name,
    pictogramIndex: member.pictogramIndex,
    cheerMessage: member.cheerMessage,
    certifiedDays: member.certifiedDays,
    distanceKm: member.distanceKm,
    durationSeconds: member.durationSeconds,
    months: member.months,
    badges: member.badges,
  };
  const memberNavigator = thirdSeasonReport.members.map((item) => ({
    id: item.id,
    name: item.name,
    pictogramIndex: item.pictogramIndex,
  }));

  return (
    <main className="bg-oriwan-bg">
      <PersonalSeasonReport
        member={reportMember}
        members={memberNavigator}
        reportBasePath={THIRD_SEASON_REPORT_PATH}
      />
    </main>
  );
}
