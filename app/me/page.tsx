import { redirect } from "next/navigation";

// Preserve existing bookmarks/login return URLs with one canonical editor.
export default function MePage() {
  redirect("/4th/dashboard#my-activity");
}
