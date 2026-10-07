export const SITE_NAME = "Geodex";

export const SITE_DESCRIPTION =
  "A geography guessing game on an interactive world map. Find countries by name or name them by shape, race the clock, build streaks and climb the leaderboard.";

/**
 * The site's public address, with no trailing slash, for absolute URLs in the
 * sitemap, robots.txt and share cards. Set NEXT_PUBLIC_SITE_URL once the
 * real domain exists. Until then Netlify's own `URL` variable (the site's
 * primary address, present at build time and at runtime) is used, and
 * localhost when running locally.
 */
export function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

/**
 * False on Netlify deploy previews and branch deploys (CONTEXT is anything
 * but "production"), true on the real site and everywhere CONTEXT isn't set
 * (local dev and builds). Used to keep non-production copies out of search
 * results.
 */
export function isProductionDeploy(): boolean {
  const context = process.env.CONTEXT;
  return !context || context === "production";
}
