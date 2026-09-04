import { redirect } from "next/navigation";

export default async function LegacyParticipantReportPage({
  params,
}: {
  params: Promise<{ participantId: string }>;
}) {
  const { participantId } = await params;
  redirect(`/dashboard/report/3th/${encodeURIComponent(participantId)}`);
}
