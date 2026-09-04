import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardClient } from "@/app/dashboard/dashboard-client";
import { MemberServiceAdPocBanner } from "@/components/member-service-ad-poc-banner";
import { ACTUAL_CERTIFICATION_START_DATE, CERTIFICATION_DISPLAY_START_DATE, CHALLENGE_END_DATE, CHALLENGE_START_DATE } from "@/lib/challenge";
import type { PublicDashboardPayload } from "@/lib/public-dashboard-data";
import { addDays, toIsoDate } from "@/lib/run-records";

export const metadata: Metadata = {
  title: "멤버 서비스 광고 POC | TWTT 러닝보드",
  description: "대시보드 상단 멤버 서비스 광고 구좌 예시 화면입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

const POC_MEMBERS = [
  { id: "poc-member-1", name: "손윤정", certifiedDays: 100, distanceKm: 321.6, durationSeconds: 170_562 },
  { id: "poc-member-2", name: "신민희", certifiedDays: 100, distanceKm: 459.5, durationSeconds: 192_630 },
  { id: "poc-member-3", name: "안승재", certifiedDays: 100, distanceKm: 622.8, durationSeconds: 186_618 },
  { id: "poc-member-4", name: "윤희상", certifiedDays: 96, distanceKm: 410.4, durationSeconds: 192_868 },
  { id: "poc-member-5", name: "이경민", certifiedDays: 82, distanceKm: 764.1, durationSeconds: 348_540 },
] as const;

function makePocDashboardData(): PublicDashboardPayload {
  const startDate = new Date(`${ACTUAL_CERTIFICATION_START_DATE}T00:00:00`);
  const records = POC_MEMBERS.flatMap((member, memberIndex) => {
    const dayIndexes = member.certifiedDays === 96
      ? Array.from({ length: member.certifiedDays }, (_, index) => index + 4)
      : Array.from({ length: member.certifiedDays }, (_, index) => index);

    return dayIndexes.map((dayIndex) => ({
      id: `poc-record-${memberIndex + 1}-${dayIndex + 1}`,
      participant_id: member.id,
      record_date: toIsoDate(addDays(startDate, dayIndex)),
      distance_km: Number((member.distanceKm / member.certifiedDays).toFixed(3)),
      duration_seconds: Math.round(member.durationSeconds / member.certifiedDays),
      status: "certified" as const,
      space_label: dayIndex % 3 === 0 ? "서울 한강" : "서울 성수",
      is_recovery_certification: false,
    }));
  });

  return {
    from: CERTIFICATION_DISPLAY_START_DATE,
    to: CHALLENGE_END_DATE,
    certification_display_start_date: CERTIFICATION_DISPLAY_START_DATE,
    challenge_start_date: CHALLENGE_START_DATE,
    challenge_end_date: CHALLENGE_END_DATE,
    generated_at: "2026-08-12T07:00:00.000Z",
    participants: POC_MEMBERS.map(({ id, name }, displayOrder) => ({
      id,
      name,
      active: true,
      display_order: displayOrder + 1,
    })),
    records,
    growth_badges: [],
  };
}

export default function MemberServiceAdPocPage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  const initialData = makePocDashboardData();
  return (
    <DashboardClient
      initialData={initialData}
      initialTodayIso={CHALLENGE_END_DATE}
      announcementsEnabled={false}
      liveDataEnabled={false}
      topSlot={<MemberServiceAdPocBanner />}
    />
  );
}
