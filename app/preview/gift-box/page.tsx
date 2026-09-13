import { notFound } from "next/navigation";
import { GiftPreview } from "./preview";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <GiftPreview />;
}
