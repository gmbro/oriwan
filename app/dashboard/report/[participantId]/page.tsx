import { notFound } from "next/navigation";
import { PersonalSeasonReport } from "@/components/personal-season-report";
import { getSeasonReport } from "@/lib/season-report-server";

export const revalidate = 300;

export async function generateStaticParams() {
  const report = await getSeasonReport();
  return report.members.map((member) => ({ participantId: member.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  const report = await getSeasonReport();
  const member = report.members.find((item) => item.id === participantId);
  return {
    title: member ? `${member.name}님의 100일 리포트 | 스내사 러닝보드` : "100일 리포트 | 스내사 러닝보드",
    description: member?.statement || "스내사 크루의 개인 100일 러닝 리포트",
  };
}

export default async function PersonalSeasonReportPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  const report = await getSeasonReport();
  const member = report.members.find((item) => item.id === participantId);
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
  const memberNavigator = report.members.map((item) => ({
    id: item.id,
    name: item.name,
    pictogramIndex: item.pictogramIndex,
  }));

  return (
    <main className="bg-oriwan-bg">
      <PersonalSeasonReport member={reportMember} members={memberNavigator} />
    </main>
  );
}
