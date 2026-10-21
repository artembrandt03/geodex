import { defineConfig, devices } from "@playwright/test";
import {
  APP_PORT,
  BASE_URL,
  MAIL_API,
  MAIL_API_PORT,
  SMTP_PORT,
  TEST_DATABASE_URL,
  assertTestDatabase,
} from "./e2e/support/env";

assertTestDatabase(TEST_DATABASE_URL);

const isCI = Boolean(process.env.CI);

/** The spec that needs the app's full decorative motion; see the motion projects below. */
const MOTION_SPEC = "**/motion.spec.ts";

/**
 * End-to-end suite. It runs against a production build of the app (the real
 * code paths, not the dev server's) with its own database and a fake mail
 * server (e2e/mail-sink.mjs). Desktop projects run every spec except the ones
 * under e2e/mobile/ (which run on the two phone projects instead) and
 * e2e/motion.spec.ts (which runs last, alone, on the two motion projects).
 *
 *   npm run test:e2e              everything (Chromium + WebKit, desktop + phone)
 *   npm run test:e2e:chromium     the fast loop
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  // The animated map, clouds and WebAssembly make WebKit in particular slow when several
  // browsers share a machine, so a test that fails once is retried; Playwright lists
  // any that only passed on a retry as "flaky" so they don't hide.
  retries: 2,
  workers: isCI ? 2 : 3,
  timeout: 45_000,
  // Generous because WebKit (especially Playwright's Windows build) can take a while to
  // finish a page; an assertion only waits that long when something is actually wrong.
  expect: { timeout: 20_000 },
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    // The app drops its endless decorative animation (48 cloud canvases, the WebGL particle
    // field) for visitors who ask for reduced motion. Running the suite that way keeps every
    // page light, which is what keeps WebKit from timing out; e2e/motion.spec.ts is the one
    // place that turns full motion back on.
    reducedMotion: "reduce",
    // A click or fill that hasn't finished in 20 seconds is hung, not slow. Playwright's
    // experimental WebKit-on-Windows build loses animation frames now and then (about one
    // action in a hundred, at random), which makes its "wait until stable" step wait for
    // the whole test time limit. Failing the action early costs 20 seconds instead of 90,
    // and the retry then passes. (Linux CI's WebKit doesn't do this.)
    actionTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/mobile/**", MOTION_SPEC],
    },
    {
      name: "webkit-desktop",
      timeout: 90_000,
      use: { ...devices["Desktop Safari"] },
      testIgnore: ["**/mobile/**", MOTION_SPEC],
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: "**/mobile/**/*.spec.ts",
    },
    {
      name: "mobile-safari",
      timeout: 90_000,
      use: { ...devices["iPhone 14"] },
      testMatch: "**/mobile/**/*.spec.ts",
    },
    // The full-motion tests (48 animated canvases plus a WebGL field per page) are heavy
    // enough to starve every other test's browser when they run alongside them, so they run
    // last and alone: each project waits for all the ones before it. (Playwright skips a
    // project whose dependency failed, so a broken suite doesn't also run these.)
    {
      name: "motion-chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: MOTION_SPEC,
      dependencies: ["chromium-desktop", "webkit-desktop", "mobile-chrome", "mobile-safari"],
    },
    {
      name: "motion-webkit",
      timeout: 90_000,
      use: { ...devices["Desktop Safari"] },
      testMatch: MOTION_SPEC,
      dependencies: ["motion-chromium"],
    },
  ],
  webServer: [
    {
      command: "node e2e/mail-sink.mjs",
      url: `${MAIL_API}/health`,
      reuseExistingServer: !isCI,
      env: { E2E_SMTP_PORT: String(SMTP_PORT), E2E_MAIL_API_PORT: String(MAIL_API_PORT) },
    },
    {
      // Builds first, so the suite always tests the current code.
      // --keepAliveTimeout: Next closes idle connections after 5 seconds, and Playwright's HTTP
      // client now and then reuses one just as it closes (ECONNRESET). Keeping them open for
      // two minutes, far longer than any gap between requests in a test, removes the race.
      command: `npm run build && npx next start -p ${APP_PORT} --keepAliveTimeout 120000`,
      url: BASE_URL,
      timeout: 300_000,
      reuseExistingServer: !isCI,
      env: {
        // Every outgoing-email and database setting is set explicitly, so a value
        // in a developer's own .env (a real Gmail password!) can never be used.
        DATABASE_URL: TEST_DATABASE_URL,
        AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else",
        AUTH_TRUST_HOST: "true",
        NEXT_PUBLIC_SITE_URL: BASE_URL,
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(SMTP_PORT),
        SMTP_SECURE: "false",
        SMTP_USER: "e2e",
        SMTP_PASS: "e2e",
        FEEDBACK_TO_EMAIL: "feedback@e2e.test",
        FEEDBACK_FROM_EMAIL: "geodex@e2e.test",
        EMAIL_DAILY_LIMIT: "100000",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
