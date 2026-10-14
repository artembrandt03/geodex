import { Pool } from "pg";
import { TEST_DATABASE_URL, assertTestDatabase } from "./env";

/**
 * Direct access to the test database, for the few things the app deliberately
 * doesn't expose (is this feedback row saved? did the account get deleted?).
 * One small pool per worker process.
 */
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    assertTestDatabase(TEST_DATABASE_URL);
    const url = new URL(TEST_DATABASE_URL);
    url.search = "";
    pool = new Pool({ connectionString: url.toString(), max: 2, idleTimeoutMillis: 2_000 });
  }
  return pool;
}

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export async function userByEmail(email: string) {
  const rows = await query<{
    id: string;
    email: string;
    displayName: string;
    emailVerifiedAt: Date | null;
    passwordHash: string | null;
    profilePublic: boolean;
  }>('SELECT * FROM "User" WHERE lower(email) = lower($1)', [email]);
  return rows[0] ?? null;
}

export async function resultsFor(userId: string) {
  return query<{ score: number; mode: string; difficulty: string; roundLength: number }>(
    'SELECT * FROM "GameResult" WHERE "userId" = $1 ORDER BY "createdAt"',
    [userId],
  );
}

/** Forgets the rate-limit counters, for tests that need a clean allowance. */
export async function clearRateLimits(): Promise<void> {
  await query('DELETE FROM "RateLimitHit"');
}
