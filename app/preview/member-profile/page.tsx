import { notFound } from "next/navigation";
import { MemberProfilePreview } from "./preview-client";

export default function MemberProfilePreviewPage() {
  // Sample records are only for local UI review, never a production route.
  if (process.env.NODE_ENV !== "development") notFound();
  return <MemberProfilePreview />;
}
