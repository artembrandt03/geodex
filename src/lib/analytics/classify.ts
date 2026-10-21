import { createHmac } from "node:crypto";

/**
 * The pure half of the usage statistics: turning what a request looks like into the
 * few coarse buckets the owner's dashboard shows. Nothing here is stored per person;
 * a browser string becomes "mobile" and "safari", a page address becomes a known
 * route, a referrer becomes a category, and a visitor becomes a hash that changes
 * every day. See track.ts for the database half.
 */

/** Crawlers, link-preview fetchers, monitors and automated browsers. They aren't visitors. */
const BOT_PATTERN =
  /bot\b|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|facebookexternalhit|preview|fetch|curl\/|wget|python-requests|node-fetch|axios|go-http-client|java\/|httpclient|playwright|puppeteer|phantomjs/i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.length < 10) return true;
  return BOT_PATTERN.test(userAgent);
}

export type DeviceClass = "mobile" | "tablet" | "desktop";

export function deviceClass(userAgent: string): DeviceClass {
  if (/ipad|tablet|playbook|silk/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android|windows phone/i.test(userAgent)) return "mobile";
  return "desktop";
}

export type BrowserFamily = "chrome" | "safari" | "firefox" | "edge" | "opera" | "samsung" | "other";

/** Order matters: Edge, Opera and Samsung's browser all also say "Chrome", and Chrome also says "Safari". */
export function browserFamily(userAgent: string): BrowserFamily {
  if (/edg(e|a|ios)?\//i.test(userAgent)) return "edge";
  if (/opr\/|opera/i.test(userAgent)) return "opera";
  if (/samsungbrowser/i.test(userAgent)) return "samsung";
  if (/firefox|fxios/i.test(userAgent)) return "firefox";
  if (/chrome|chromium|crios/i.test(userAgent)) return "chrome";
  if (/safari/i.test(userAgent)) return "safari";
  return "other";
}

/** The pages worth telling apart. Anything else (a 404, a probe) counts as "other". */
const PAGE_PATTERNS: [RegExp, string][] = [
  [/^\/$/, "/"],
  [/^\/setup$/, "/setup"],
  [/^\/play$/, "/play"],
  [/^\/leaderboard$/, "/leaderboard"],
  [/^\/about$/, "/about"],
  [/^\/login$/, "/login"],
  [/^\/register$/, "/register"],
  [/^\/forgot-password$/, "/forgot-password"],
  [/^\/reset-password$/, "/reset-password"],
  [/^\/verify-email$/, "/verify-email"],
  [/^\/profile$/, "/profile"],
  [/^\/players\/[^/]+$/, "/players/:id"],
  [/^\/privacy$/, "/privacy"],
  [/^\/terms$/, "/terms"],
];

/**
 * A page address as the one route it belongs to. Only the path is ever looked at (never
 * a query string, so a reset or confirmation token can't end up anywhere), a player's id
 * becomes ":id", and unknown paths collapse to "other" so a stranger can't invent
 * unlimited new keys.
 */
export function pageKey(pathname: string): string {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  for (const [pattern, key] of PAGE_PATTERNS) if (pattern.test(path)) return key;
  return "other";
}

/** Known places visitors arrive from, matched on the referrer's host name. */
const REFERRER_SOURCES: [RegExp, string][] = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)yahoo\./, "yahoo"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)l\.facebook\.com$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(twitter|x)\.com$|^t\.co$/, "x"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)github\.com$/, "github"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)discord(app)?\.com$/, "discord"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)whatsapp\.com$/, "whatsapp"],
  [/(^|\.)artembrandt\.ca$/, "artembrandt.ca"],
];

/**
 * Where a visit came from, as a short bucket: "direct" (nothing, or the site itself),
 * a known source, or "other". Buckets rather than the raw host, so the set of keys
 * stays small and nothing identifying is kept.
 */
export function referrerSource(referrer: string | null | undefined, ownHost: string | null | undefined): string {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }
  if (ownHost && (host === ownHost.toLowerCase().split(":")[0] || host.endsWith(`.${ownHost.toLowerCase().split(":")[0]}`))) {
    return "direct";
  }
  for (const [pattern, source] of REFERRER_SOURCES) if (pattern.test(host)) return source;
  return "other";
}

/** A calendar day in UTC as "YYYY-MM-DD". */
export function utcDayString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Identifies a visitor for one day only. The day is part of the input and the key, so
 * the same person gets a different hash tomorrow and yesterday's can never be matched
 * to today's; it is an HMAC, so it can't be reversed to an IP address either. Rows are
 * deleted after two days anyway.
 */
export function visitorHash(secret: string, day: string, ip: string, userAgent: string): string {
  return createHmac("sha256", `${secret}:visitor:${day}`).update(`${ip}|${userAgent}`).digest("hex").slice(0, 32);
}
