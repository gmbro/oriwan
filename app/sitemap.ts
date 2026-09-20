import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/public-site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only published, substantive public pages belong here. Draft magazine lists,
  // member records, and administration pages are deliberately excluded.
  return ["/", "/about", "/running-community", "/habit-challenge", "/magazine/record-guide"].map(path => ({
    url: new URL(path, PUBLIC_SITE_URL).href,
    lastModified: new Date("2026-09-21T00:00:00+09:00"),
    changeFrequency: path === "/" ? "daily" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
