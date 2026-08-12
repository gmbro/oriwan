import { connection } from "next/server";
import { notFound } from "next/navigation";
import { DashboardSiteHeader } from "@/components/dashboard-site-header";
import { PersonalSeasonReport } from "@/components/personal-season-report";
import { getSeasonReport } from "@/lib/season-report-server";

export async function generateMetadata({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  await connection();
  const report = await getSeasonReport();
  const member = report.members.find((item) => item.id === participantId);
  return {
    title: member ? `${member.name}님의 100일 리포트 | 스내사 러닝보드` : "100일 리포트 | 스내사 러닝보드",
    description: member?.statement || "스내사 크루의 개인 100일 러닝 리포트",
  };
}

export default async function PersonalSeasonReportPage({ params }: { params: Promise<{ participantId: string }> }) {
  await connection();
  const { participantId } = await params;
  const report = await getSeasonReport();
  const member = report.members.find((item) => item.id === participantId);
  if (!member) notFound();

  const memberNavigator = report.members.map((item) => ({
    id: item.id,
    name: item.name,
    pictogramIndex: item.pictogramIndex,
    theme: item.theme,
    hasHundredDayBadge: item.hasHundredDayBadge,
  }));

  return (
    <main className="min-h-screen bg-oriwan-bg">
      <DashboardSiteHeader active="report" />
      <PersonalSeasonReport member={member} members={memberNavigator} />
    </main>
  );
}
