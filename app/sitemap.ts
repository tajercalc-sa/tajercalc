import type { MetadataRoute } from "next";
import { NAV, SITE, TOOLS } from "@/lib/site";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return [...NAV.map((n) => n.href), ...TOOLS.map((t) => t.href), "/privacy/"].map((p) => ({ url: `${SITE.url}${p}`, changeFrequency: "monthly" }));
}
