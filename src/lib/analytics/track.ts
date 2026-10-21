import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The database half of the usage statistics (the pure half is classify.ts).
 *
 * Everything here is best effort: it records a number on the side and must never
 * make a login, a signup or a round fail, so errors are logged and swallowed. It is
 * awaited rather than fired and forgotten, because a serverless function can stop as
 * soon as it has responded and silently drop work still in flight.
 */

/** Counter keys are short, fixed names written in code, never user input. */
const MAX_KEY_LENGTH = 100;

const TODAY = Prisma.sql`(now() AT TIME ZONE 'UTC')::date`;

/** Adds to today's (UTC) count for each key, creating the row if it's the first of the day. */
export async function trackMany(increments: Record<string, number>): Promise<void> {
  const rows = Object.entries(increments).filter(
    ([key, amount]) => key.length > 0 && key.length <= MAX_KEY_LENGTH && Number.isFinite(amount) && amount !== 0,
  );
  if (rows.length === 0) return;
  try {
    const values = Prisma.join(rows.map(([key, amount]) => Prisma.sql`(${TODAY}, ${key}, ${Math.trunc(amount)})`));
    await prisma.$executeRaw`
      INSERT INTO "DailyCounter" ("day", "key", "count") VALUES ${values}
      ON CONFLICT ("day", "key") DO UPDATE SET "count" = "DailyCounter"."count" + EXCLUDED."count"`;
  } catch (error) {
    console.error("[analytics] could not record", Object.keys(increments), error);
  }
}

/** Adds one to today's count for a key, such as "login.failed" or "signup.created". */
export function track(key: string, amount = 1): Promise<void> {
  return trackMany({ [key]: amount });
}

/** Notes that this account was active today (UTC). One row per account per day at most. */
export async function touchActivity(userId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO "UserActivityDay" ("userId", "day") VALUES (${userId}, ${TODAY})
      ON CONFLICT ("userId", "day") DO NOTHING`;
  } catch (error) {
    console.error("[analytics] could not record activity", error);
  }
}
