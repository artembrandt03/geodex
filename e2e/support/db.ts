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

/** Makes every emailed link for this account already expired. */
export async function expireTokens(email: string): Promise<void> {
  await query(
    `UPDATE "EmailToken" SET "expiresAt" = now() - interval '1 minute'
     WHERE "userId" IN (SELECT id FROM "User" WHERE lower(email) = lower($1))`,
    [email],
  );
}

/**
 * Puts a finished round straight onto a leaderboard, for tests that are about how
 * a board LOOKS and shouldn't each have to play a whole round to fill it. Uses the
 * current scoring version, since the boards ignore older ones.
 */
export async function seedResult(
  userId: string,
  {
    mode = "NAME",
    difficulty = "EASY",
    roundLength = 5,
    score = 100,
    correct = 5,
  }: { mode?: string; difficulty?: string; roundLength?: number; score?: number; correct?: number } = {},
): Promise<void> {
  await query(
    `INSERT INTO "GameResult"
       (id, "userId", mode, difficulty, "roundLength", score, correct, "totalTimeMs", "bestStreak", "neighborCount", "scoringVersion", "roundNonce")
     VALUES ($1, $2, $3::"GameMode", $4::"Difficulty", $5, $6, $7, 30000, $7, 0, 2, $1)`,
    [`e2e-${Math.random().toString(36).slice(2, 12)}`, userId, mode, difficulty, roundLength, score, correct],
  );
}
