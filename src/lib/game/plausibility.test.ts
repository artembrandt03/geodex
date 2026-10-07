import { describe, expect, it } from "vitest";
import {
  MIN_MS_PER_QUESTION,
  checkRoundPlausible,
  maxStreakBonus,
  scoreBounds,
  type RoundClaim,
} from "./plausibility";
import { scoreAnswer } from "./scoring";

const claim = (overrides: Partial<RoundClaim> = {}): RoundClaim => ({
  mode: "NAME",
  difficulty: "EASY",
  roundLength: 10,
  score: 100,
  correct: 6,
  totalTimeMs: 40_000,
  bestStreak: 3,
  neighborCount: 1,
  ...overrides,
});

describe("maxStreakBonus", () => {
  it("is 0 below a streak of 3", () => {
    expect(maxStreakBonus(10, 2)).toBe(0);
    expect(maxStreakBonus(0, 0)).toBe(0);
  });

  it("packs answers into the longest runs allowed", () => {
    expect(maxStreakBonus(3, 3)).toBe(5);
    expect(maxStreakBonus(5, 5)).toBe(5 + 6 + 7);
    // 6 correct, no run over 3: two runs of 3 beat anything else.
    expect(maxStreakBonus(6, 3)).toBe(10);
  });
});

describe("scoreBounds", () => {
  it("brackets a round by difficulty", () => {
    const easy = scoreBounds({ difficulty: "EASY", correct: 5, bestStreak: 5, neighborCount: 0 });
    expect(easy.min).toBe(50);
    expect(easy.max).toBe(5 * 20 + 18);
    const hard = scoreBounds({ difficulty: "HARD", correct: 5, bestStreak: 0, neighborCount: 2 });
    expect(hard.min).toBe(5 * 30 + 2);
  });
});

describe("checkRoundPlausible", () => {
  it("accepts an ordinary round", () => {
    expect(checkRoundPlausible(claim()).ok).toBe(true);
  });

  it("accepts a perfect, very fast round at the exact maximum", () => {
    const { max } = scoreBounds({
      difficulty: "HARD",
      correct: 20,
      bestStreak: 20,
      neighborCount: 0,
    });
    const verdict = checkRoundPlausible(
      claim({
        difficulty: "HARD",
        roundLength: 20,
        correct: 20,
        bestStreak: 20,
        neighborCount: 0,
        score: max,
        totalTimeMs: 20 * MIN_MS_PER_QUESTION.NAME,
      }),
    );
    expect(verdict.ok).toBe(true);
  });

  it("rejects a forged score", () => {
    const verdict = checkRoundPlausible(claim({ score: 2_000_000 }));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/above the maximum/);
  });

  it("rejects a score below what the correct answers earn", () => {
    expect(checkRoundPlausible(claim({ score: 5 })).ok).toBe(false);
  });

  it("rejects a round finished faster than a person can play it", () => {
    const verdict = checkRoundPlausible(
      claim({
        roundLength: 20,
        correct: 10,
        bestStreak: 5,
        neighborCount: 0,
        score: 150,
        totalTimeMs: 1_000,
      }),
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/under the minimum/);
  });

  it("holds shape mode to a slower floor than name mode", () => {
    const quick = { totalTimeMs: 10 * 600 };
    expect(checkRoundPlausible(claim({ mode: "NAME", ...quick })).ok).toBe(true);
    expect(checkRoundPlausible(claim({ mode: "SHAPE", ...quick })).ok).toBe(false);
  });

  it("rejects impossible counts", () => {
    expect(checkRoundPlausible(claim({ correct: 11 })).ok).toBe(false);
    expect(checkRoundPlausible(claim({ correct: 6, neighborCount: 5 })).ok).toBe(false);
    expect(checkRoundPlausible(claim({ correct: 4, bestStreak: 5 })).ok).toBe(false);
    expect(
      checkRoundPlausible(claim({ correct: 0, bestStreak: 2, score: 0, neighborCount: 0 })).ok,
    ).toBe(false);
  });

  it("rejects a streak too short for the number of correct answers", () => {
    // 9 right and 1 wrong splits into at most 2 runs, so some run is at least 5 long.
    const verdict = checkRoundPlausible(
      claim({ correct: 9, bestStreak: 2, neighborCount: 0, score: 200 }),
    );
    expect(verdict.ok).toBe(false);
  });
});

// The guarantee that matters most: an honest player is never turned away.
// Replays thousands of random rounds through the real scoring function and
// checks every one passes, so the bounds can't be tighter than the rules.
describe("never rejects an honest round", () => {
  // Small seeded PRNG so a failure is reproducible.
  function rng(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  it("holds across 5000 simulated rounds", () => {
    const rand = rng(12345);
    const difficulties = ["EASY", "MEDIUM", "HARD"] as const;
    const modes = ["NAME", "SHAPE"] as const;
    const lengths = [5, 10, 15, 20];

    for (let i = 0; i < 5000; i++) {
      const difficulty = difficulties[Math.floor(rand() * 3)];
      const mode = modes[Math.floor(rand() * 2)];
      const roundLength = lengths[Math.floor(rand() * 4)];
      const accuracy = rand();

      let score = 0;
      let correct = 0;
      let streak = 0;
      let bestStreak = 0;
      let neighborCount = 0;
      let totalTimeMs = 0;

      for (let q = 0; q < roundLength; q++) {
        const right = rand() < accuracy;
        const neighbor = !right && rand() < 0.3;
        // From the fastest humanly allowed to a slow 40s.
        const elapsedMs = Math.round(MIN_MS_PER_QUESTION[mode] + rand() * 40_000 * rand());
        streak = right ? streak + 1 : 0;
        score += scoreAnswer({ mode, difficulty, correct: right, neighbor, elapsedMs, streak }).total;
        correct += right ? 1 : 0;
        bestStreak = Math.max(bestStreak, streak);
        neighborCount += neighbor ? 1 : 0;
        totalTimeMs += elapsedMs;
      }

      const round = {
        mode,
        difficulty,
        roundLength,
        score,
        correct,
        totalTimeMs,
        bestStreak,
        neighborCount,
      };
      expect(checkRoundPlausible(round), JSON.stringify(round)).toEqual({ ok: true });
    }
  });
});
