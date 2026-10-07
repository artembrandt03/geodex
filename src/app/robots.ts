import type { MetadataRoute } from "next";
import { isProductionDeploy, siteUrl } from "@/lib/site";

/**
 * Served at /robots.txt. Crawlers are welcome on the public pages and kept
 * out of the ones that have no business in search results: the API, account
 * pages, the login and signup forms, player profiles (people's pages, which
 * can also be made private), and /play, which is useless without a round in
 * progress. (This is a request to well-behaved crawlers, not security: private
 * data is protected by the code.) Non-production deploys, like Netlify previews,
 * are closed to crawlers entirely so they never compete with the real site.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProductionDeploy()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/profile", "/players/", "/login", "/register", "/play"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
