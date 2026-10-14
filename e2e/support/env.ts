/**
 * Where the end-to-end suite runs. Everything here is deliberately separate
 * from local development: its own database (geodex_test), its own app port and
 * a mail sink instead of a real SMTP server, so a test run can never touch dev
 * data or send real email.
 */
export const APP_PORT = 3200;
export const BASE_URL = `http://localhost:${APP_PORT}`;

/** The fake SMTP server the app sends to, and the HTTP side tests read mail from. */
export const SMTP_PORT = 2526;
export const MAIL_API_PORT = 2527;
export const MAIL_API = `http://127.0.0.1:${MAIL_API_PORT}`;

/** Same Postgres container as development (docker-compose.yml), a different database. CI overrides this. */
export const TEST_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://geodex:geodex_dev_password@localhost:5442/geodex_test?schema=public";

/** The database name in a Postgres URL. */
export function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

/** The suite wipes tables, so it refuses to run against anything that isn't clearly a test database. */
export function assertTestDatabase(url: string): void {
  const name = databaseName(url);
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run end-to-end tests against database "${name}": its name must end in "_test".`,
    );
  }
}

/** The one password every test account uses. */
export const PASSWORD = "E2ePassw0rd!";
