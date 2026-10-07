import { describe, expect, it, vi } from "vitest";

// rateLimit.ts imports the Prisma client at module load; only the pure helpers are tested here.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { minutesUntil, retryAfterMs } from "./rateLimit";

const MIN = 60_000;

describe("retryAfterMs", () => {
  const now = 10_000_000;

  it("is 0 while the allowance isn't used up", () => {
    expect(retryAfterMs([], 5, 15 * MIN, now)).toBe(0);
    expect(retryAfterMs([now - 1000, now - 2000], 5, 15 * MIN, now)).toBe(0);
  });

  it("blocks once the limit is reached, until the oldest counted event ages out", () => {
    // Five failures at 1..5 minutes ago in a 15 minute window: the oldest (5 min
    // ago) leaves the window 10 minutes from now.
    const events = [1, 2, 3, 4, 5].map((m) => now - m * MIN);
    expect(retryAfterMs(events, 5, 15 * MIN, now)).toBe(10 * MIN);
  });

  it("counts only enough expiries to get back under the limit", () => {
    // Six events (14, 5, 4, 3, 2, 1 minutes ago), limit 5. The 14-minute-old one
    // leaves the window in 1 minute, but that still leaves five, so the wait
    // runs until the next-oldest (5 minutes ago) ages out: 10 minutes.
    const events = [1, 2, 3, 4, 5, 14].map((m) => now - m * MIN);
    expect(retryAfterMs(events, 5, 15 * MIN, now)).toBe(10 * MIN);
  });

  it("ignores events outside the window", () => {
    const old = [20, 30, 40, 50, 60].map((m) => now - m * MIN);
    expect(retryAfterMs(old, 5, 15 * MIN, now)).toBe(0);
  });

  it("doesn't care what order the events come in", () => {
    const events = [5, 1, 4, 2, 3].map((m) => now - m * MIN);
    expect(retryAfterMs(events, 5, 15 * MIN, now)).toBe(10 * MIN);
  });
});

describe("minutesUntil", () => {
  it("rounds up and never says 0", () => {
    expect(minutesUntil(0)).toBe(1);
    expect(minutesUntil(1)).toBe(1);
    expect(minutesUntil(60_000)).toBe(1);
    expect(minutesUntil(60_001)).toBe(2);
    expect(minutesUntil(10 * MIN)).toBe(10);
  });
});
