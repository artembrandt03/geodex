import { prisma } from "@/lib/prisma";

/**
 * A small database-backed rate limiter for things that need throttling by
 * more than one key at once (failed logins per email *and* per IP, signups
 * per IP). Every counted event is a row in RateLimitHit; "limited" means
 * the key has used up its allowance within the window. Rows age out on their
 * own, and a success can clear its own key (a correct login wipes that
 * email's failures).
 *
 * Database rather than memory because the app runs as serverless functions
 * on Netlify: separate instances share nothing, so an in-memory counter
 * would let an attacker hit a different instance each time.
 */

export interface RateLimitRule {
  /** What's being limited, e.g. "login-fail:email". */
  bucket: string;
  /** The thing it's limited by, already hashed (see hashKey in lib/clientIp). */
  key: string;
  /** How many events are allowed inside the window; the next one is refused. */
  limit: number;
  windowMs: number;
}

/**
 * How long until another event is allowed: 0 if the allowance isn't used up,
 * otherwise the time until the oldest event that still counts ages out of the
 * window far enough to drop back under the limit. Pure, so it's easy to test.
 */
export function retryAfterMs(
  eventTimes: number[],
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): number {
  const recent = eventTimes.filter((t) => t > now - windowMs).sort((a, b) => a - b);
  if (recent.length < limit) return 0;
  const unblockAt = recent[recent.length - limit] + windowMs;
  return Math.max(0, unblockAt - now);
}

/** Whole minutes for a message ("try again in 12 minutes"), never less than 1. */
export function minutesUntil(ms: number): number {
  return Math.max(1, Math.ceil(ms / 60_000));
}

export async function checkRateLimit(
  rule: RateLimitRule,
): Promise<{ limited: boolean; retryAfterMs: number }> {
  const since = new Date(Date.now() - rule.windowMs);
  const hits = await prisma.rateLimitHit.findMany({
    where: { bucket: rule.bucket, key: rule.key, createdAt: { gt: since } },
    select: { createdAt: true },
  });
  const wait = retryAfterMs(
    hits.map((h) => h.createdAt.getTime()),
    rule.limit,
    rule.windowMs,
  );
  return { limited: wait > 0, retryAfterMs: wait };
}

const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Counts one event against a key. Occasionally sweeps out rows far too old to matter. */
export async function recordHit(bucket: string, key: string): Promise<void> {
  await prisma.rateLimitHit.create({ data: { bucket, key } });
  if (Math.random() < 0.02) {
    await prisma.rateLimitHit.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - PRUNE_AFTER_MS) } },
    });
  }
}

/** Forgets a key's events, e.g. after a successful login. */
export async function clearHits(bucket: string, key: string): Promise<void> {
  await prisma.rateLimitHit.deleteMany({ where: { bucket, key } });
}
