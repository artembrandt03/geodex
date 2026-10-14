import { execSync } from "node:child_process";
import { Client } from "pg";
import { TEST_DATABASE_URL, assertTestDatabase, databaseName } from "./support/env";

/**
 * Runs once before the suite: make sure the test database exists, bring it to
 * the current schema, load the country list, and clear anything a previous run
 * left behind (accounts, results, rate-limit counters, feedback).
 */
export default async function globalSetup() {
  assertTestDatabase(TEST_DATABASE_URL);
  const dbName = databaseName(TEST_DATABASE_URL);

  // Create the database if this is a fresh machine (CI creates it up front).
  const maintenanceUrl = new URL(TEST_DATABASE_URL);
  maintenanceUrl.pathname = "/postgres";
  maintenanceUrl.search = "";
  const admin = new Client({ connectionString: maintenanceUrl.toString() });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });

  const url = new URL(TEST_DATABASE_URL);
  url.search = "";
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await client.query(
    'TRUNCATE TABLE "User", "EmailToken", "GameResult", "Feedback", "RateLimitHit" RESTART IDENTITY CASCADE',
  );
  await client.end();
}
