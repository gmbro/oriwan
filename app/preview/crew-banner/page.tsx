import { notFound } from "next/navigation";
import { CrewBannerPreview } from "./preview-client";
import styles from "./preview.module.css";

export default function CrewBannerPreviewPage() {
  // Preview fixtures must never be shown as production certification data.
  if (process.env.NODE_ENV !== "development") notFound();
  return <CrewBannerPreview note={<p className={styles.note}>로컬 디자인 미리보기 · 수치는 예시이며 운영 대시보드에는 실제 인증 인원과 인증률이 표시됩니다.</p>} />;
}
