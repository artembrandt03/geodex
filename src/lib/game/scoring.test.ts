import { describe, expect, it } from "vitest";
import {
  BASE_POINTS,
  NEIGHBOR_BONUS,
  scoreAnswer,
  speedTierFor,
  streakBonusFor,
  type ScoreInput,
} from "./scoring";

const answer = (overrides: Partial<ScoreInput> = {}) =>
  scoreAnswer({
    difficulty: "EASY",
    correct: true,
    neighbor: false,
    elapsedMs: 60_000,
    streak: 1,
    ...overrides,
  });

describe("base points", () => {
  it("is 10 / 20 / 30 for Easy / Medium / Hard when answered slowly", () => {
    expect(answer({ difficulty: "EASY" }).total).toBe(10);
    expect(answer({ difficulty: "MEDIUM" }).total).toBe(20);
    expect(answer({ difficulty: "HARD" }).total).toBe(30);
    expect(BASE_POINTS).toEqual({ EASY: 10, MEDIUM: 20, HARD: 30 });
  });
});

describe("speed bonus", () => {
  it("picks the tightest tier the answer beat", () => {
    expect(speedTierFor(0)?.maxMs).toBe(5_000);
    expect(speedTierFor(5_000)?.maxMs).toBe(5_000);
    expect(speedTierFor(5_001)?.maxMs).toBe(10_000);
    expect(speedTierFor(10_000)?.maxMs).toBe(10_000);
    expect(speedTierFor(15_000)?.maxMs).toBe(15_000);
    expect(speedTierFor(15_001)).toBeNull();
  });

  it("scales with difficulty: +100% / +50% / +25% of the base", () => {
    expect(answer({ elapsedMs: 3_000 }).speedBonus).toBe(10);
    expect(answer({ elapsedMs: 8_000 }).speedBonus).toBe(5);
    expect(answer({ elapsedMs: 12_000 }).speedBonus).toBe(3); // 2.5 rounds up
    expect(answer({ elapsedMs: 20_000 }).speedBonus).toBe(0);

    expect(answer({ difficulty: "MEDIUM", elapsedMs: 3_000 }).speedBonus).toBe(20);
    expect(answer({ difficulty: "HARD", elapsedMs: 3_000 }).speedBonus).toBe(30);
    expect(answer({ difficulty: "HARD", elapsedMs: 8_000 }).speedBonus).toBe(15);
    expect(answer({ difficulty: "HARD", elapsedMs: 12_000 }).speedBonus).toBe(8); // 7.5
  });

  it("is added on top of the base", () => {
    expect(answer({ elapsedMs: 3_000 }).total).toBe(20);
  });
});

describe("streak bonus", () => {
  it("starts at a streak of 3 with +5 and grows by 1 per further answer", () => {
    expect(streakBonusFor(0)).toBe(0);
    expect(streakBonusFor(1)).toBe(0);
    expect(streakBonusFor(2)).toBe(0);
    expect(streakBonusFor(3)).toBe(5);
    expect(streakBonusFor(4)).toBe(6);
    expect(streakBonusFor(5)).toBe(7);
    expect(streakBonusFor(10)).toBe(12);
  });

  it("is added to the answer that extends the streak", () => {
    expect(answer({ streak: 2 }).streakBonus).toBe(0);
    expect(answer({ streak: 3 }).total).toBe(15);
    expect(answer({ streak: 4 }).total).toBe(16);
  });
});

describe("wrong answers", () => {
  it("score 0 whatever the time or streak", () => {
    const wrong = answer({ correct: false, streak: 0, elapsedMs: 1_000 });
    expect(wrong).toEqual({
      base: 0,
      speedBonus: 0,
      streakBonus: 0,
      neighborBonus: 0,
      total: 0,
    });
  });

  it("earn only the neighbor bonus when the guess borders the answer", () => {
    const close = answer({ correct: false, neighbor: true, streak: 0, elapsedMs: 1_000 });
    expect(close.neighborBonus).toBe(NEIGHBOR_BONUS);
    expect(close.total).toBe(NEIGHBOR_BONUS);
    expect(close.speedBonus).toBe(0);
  });

  it("ignore the neighbor flag when the answer is correct", () => {
    expect(answer({ neighbor: true }).neighborBonus).toBe(0);
  });
});

describe("a full breakdown", () => {
  it("adds up fast, long-streak Hard answers", () => {
    expect(answer({ difficulty: "HARD", elapsedMs: 2_000, streak: 5 })).toEqual({
      base: 30,
      speedBonus: 30,
      streakBonus: 7,
      neighborBonus: 0,
      total: 67,
    });
  });
});
