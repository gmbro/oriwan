import { notFound } from "next/navigation";
import { buildPersonalRecordsPayload } from "@/lib/personal-records";
import { MyActivityDialog } from "@/components/my-activity-dialog";

export default function MyActivityPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const today = "2026-10-08";
  const payload = buildPersonalRecordsPayload([
    ...["2026-09-23", "2026-09-25", "2026-09-29", "2026-10-01", "2026-10-04", "2026-10-06"].map((date, index) => ({ id: `demo-${index}`, date, status: "certified" as const, distanceKm: 4.2 + index, durationSeconds: 1800 + index * 300, paceSecondsPerKm: null, isRecovery: false })),
    { id: "demo-pending", date: today, status: "needs_review", distanceKm: 5.2, durationSeconds: 1930, paceSecondsPerKm: null, isRecovery: false },
  ], today);
  return <main style={{ minHeight: "100dvh", background: "#f2f4f6", padding: 32, display: "grid", placeContent: "center", gap: 16 }}>
    <p style={{ color: "#3182f6" }}>TWTT · 로컬 미리보기</p><h1 style={{ fontSize: 28, fontWeight: 700 }}>내 정보</h1>
    <p style={{ color: "#6b7684", fontSize: 14 }}>예시 데이터로 확인하는 개인 활동 화면이에요.</p>
    <MyActivityDialog name="러너" preview={{ ...payload, profile: { display_name: "러너", profile_image_url: null, connection_status: "approved", matched_participant: { id: "preview", name: "러너" } } }} />
  </main>;
}
