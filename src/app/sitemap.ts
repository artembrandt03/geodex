import type { MetadataRoute } from "next";
import { isProductionDeploy, siteUrl } from "@/lib/site";

/**
 * Served at /sitemap.xml: the pages worth knowing about, so a brand-new site
 * gets found and indexed sooner. Just the public, stable ones. Player
 * profiles are left out on purpose (there are many, they change constantly,
 * and people can make theirs private), as are the pages robots.txt keeps
 * crawlers away from. Empty on non-production deploys, matching robots.txt.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!isProductionDeploy()) return [];

  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/setup`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/leaderboard`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
