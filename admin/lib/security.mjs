/**
 * What keeps the dashboard private. It listens on the loopback address only, so nothing
 * else on the network can reach it. These checks cover the one remaining way in: a web
 * page you happen to have open in your browser trying to talk to localhost on your behalf.
 */

/** The names this server may be reached by; anything else in the Host header is refused. */
export function allowedHosts(port) {
  return new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
}

/**
 * Refuses a request whose Host header isn't one of ours. This is the defence against "DNS
 * rebinding": a malicious site points its own domain at 127.0.0.1 so that your browser
 * treats requests to your dashboard as same-origin and lets the page read the answers. Such a
 * request still carries the attacker's domain in Host, so it is turned away here.
 */
export function isAllowedHost(hostHeader, port) {
  return typeof hostHeader === "string" && allowedHosts(port).has(hostHeader.toLowerCase());
}

/**
 * Refuses a browser request that comes from another website. Browsers say where a request
 * came from in Origin (and Sec-Fetch-Site); the dashboard's own page, and a plain address typed
 * into the address bar, are fine.
 */
export function isAllowedOrigin({ origin, secFetchSite }, port) {
  if (secFetchSite && !["same-origin", "none"].includes(secFetchSite)) return false;
  if (!origin) return true;
  return allowedHosts(port).has(origin.replace(/^https?:\/\//, "").toLowerCase());
}

/** Headers that stop the page being embedded, sniffed or leaking the address, and limit what it may load. */
export const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
};
