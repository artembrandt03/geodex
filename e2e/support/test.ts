import { randomInt } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import { BASE_URL } from "./env";

/**
 * Playwright's `test`, with one addition: every test presents its own client IP
 * to the app's API, the way Netlify's x-nf-client-connection-ip header does in
 * production.
 *
 * Without it every test shares the machine's address (`next start` stamps
 * requests with it), so the per-IP limits (signups, failed logins, emails)
 * would trip as more tests ran than a real visitor ever would. A test that is
 * *about* a limit still gets the exact per-address and per-account behaviour.
 *
 * The header is added only to requests to the app's own /api/, never through
 * `extraHTTPHeaders`: that goes to every origin, and a custom header on a
 * cross-origin request (the animation's WebAssembly comes from a CDN) triggers a
 * CORS preflight the CDN refuses.
 */
const APP_ORIGIN = new URL(BASE_URL).origin;
const IP_HEADER = "x-nf-client-connection-ip";

function randomIp(): string {
  return `10.${randomInt(0, 256)}.${randomInt(0, 256)}.${randomInt(1, 255)}`;
}

export const test = base.extend<{ clientIp: string }>({
  clientIp: async ({}, provide) => {
    await provide(randomIp());
  },

  // The browser: add the header to the page's own API calls.
  context: async ({ context, clientIp }, provide) => {
    await context.route(
      (url) => url.origin === APP_ORIGIN && url.pathname.startsWith("/api/"),
      (route) => route.continue({ headers: { ...route.request().headers(), [IP_HEADER]: clientIp } }),
    );
    await provide(context);
  },

  // The `request` fixture (direct API calls) only ever talks to the app, so a plain header is fine.
  request: async ({ playwright, baseURL, clientIp }, provide) => {
    const api = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { [IP_HEADER]: clientIp },
    });
    await provide(api);
    await api.dispose();
  },
});

export { expect };
