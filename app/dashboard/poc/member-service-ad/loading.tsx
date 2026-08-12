import { DashboardLoading } from "@/app/dashboard/loading";
import { MemberServiceAdPocBannerSkeleton } from "@/components/member-service-ad-poc-banner";

export default function MemberServiceAdPocLoading() {
  return <DashboardLoading topSlot={<MemberServiceAdPocBannerSkeleton />} />;
}
