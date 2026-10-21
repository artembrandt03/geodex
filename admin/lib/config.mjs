import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Settings for the admin dashboard, read from admin/.env (git-ignored; see
 * admin/.env.example) and the environment. Real environment variables win over the file.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const ADMIN_DIR = path.resolve(here, "..");

const envFile = path.join(ADMIN_DIR, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

/** The local development database from docker-compose.yml, used until you point this at production. */
export const LOCAL_DEV_URL = "postgresql://geodex:geodex_dev_password@localhost:5442/geodex?schema=public";
export const LOCAL_DEMO_URL = "postgresql://geodex:geodex_dev_password@localhost:5442/geodex_demo?schema=public";

export function loadConfig(argv = process.argv.slice(2)) {
  const demo = argv.includes("--demo");
  const databaseUrl =
    process.env.ADMIN_DATABASE_URL_OVERRIDE ??
    (demo ? (process.env.ADMIN_DEMO_DATABASE_URL ?? LOCAL_DEMO_URL) : (process.env.ADMIN_DATABASE_URL ?? LOCAL_DEV_URL));
  return {
    demo,
    databaseUrl,
    port: Number(process.env.ADMIN_PORT ?? 4000),
    // Only used to draw the "email budget used" gauge; keep in step with the app's EMAIL_DAILY_LIMIT.
    emailDailyLimit: Number(process.env.ADMIN_EMAIL_DAILY_LIMIT ?? 400),
  };
}

/** The database's name in a connection URL, for showing which one the dashboard is looking at. */
export function databaseLabel(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ""}/${u.pathname.replace(/^\//, "")}`;
  } catch {
    return "unknown";
  }
}
