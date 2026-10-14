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

/**
 * End-to-end suite. It runs against a production build of the app (the real
 * code paths, not the dev server's) with its own database and a fake mail
 * server (e2e/mail-sink.mjs). Desktop projects run every spec except the ones
 * under e2e/mobile/, which run on the two phone projects instead.
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
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : 4,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: "**/mobile/**",
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"] },
      testIgnore: "**/mobile/**",
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: "**/mobile/**/*.spec.ts",
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
      testMatch: "**/mobile/**/*.spec.ts",
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
      command: `npm run build && npx next start -p ${APP_PORT}`,
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
