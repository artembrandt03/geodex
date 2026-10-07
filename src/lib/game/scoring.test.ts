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
    mode: "NAME",
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
    expect(speedTierFor(0, "NAME")?.maxMs).toBe(5_000);
    expect(speedTierFor(5_000, "NAME")?.maxMs).toBe(5_000);
    expect(speedTierFor(5_001, "NAME")?.maxMs).toBe(10_000);
    expect(speedTierFor(10_000, "NAME")?.maxMs).toBe(10_000);
    expect(speedTierFor(15_000, "NAME")?.maxMs).toBe(15_000);
    expect(speedTierFor(15_001, "NAME")).toBeNull();
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

describe("speed bonus in shape mode (typing takes longer)", () => {
  const shape = (overrides: Partial<ScoreInput> = {}) => answer({ mode: "SHAPE", ...overrides });

  it("doubles each window: 10s, 20s and 30s", () => {
    expect(speedTierFor(10_000, "SHAPE")?.maxMs).toBe(10_000);
    expect(speedTierFor(10_001, "SHAPE")?.maxMs).toBe(20_000);
    expect(speedTierFor(20_000, "SHAPE")?.maxMs).toBe(20_000);
    expect(speedTierFor(20_001, "SHAPE")?.maxMs).toBe(30_000);
    expect(speedTierFor(30_000, "SHAPE")?.maxMs).toBe(30_000);
    expect(speedTierFor(30_001, "SHAPE")).toBeNull();
  });

  it("keeps the same +100% / +50% / +25% bonuses", () => {
    expect(shape({ elapsedMs: 9_000 }).speedBonus).toBe(10);
    expect(shape({ elapsedMs: 18_000 }).speedBonus).toBe(5);
    expect(shape({ elapsedMs: 28_000 }).speedBonus).toBe(3);
    expect(shape({ elapsedMs: 31_000 }).speedBonus).toBe(0);
  });

  it("pays more than name mode for the same time, up to its wider windows", () => {
    // 8s is the middle tier in name mode but the top tier in shape mode.
    expect(answer({ mode: "NAME", elapsedMs: 8_000 }).speedBonus).toBe(5);
    expect(shape({ elapsedMs: 8_000 }).speedBonus).toBe(10);
    // 25s earns nothing in name mode, the bottom tier in shape mode.
    expect(answer({ mode: "NAME", elapsedMs: 25_000 }).speedBonus).toBe(0);
    expect(shape({ elapsedMs: 25_000 }).speedBonus).toBe(3);
  });

  it("names the window it fell in", () => {
    expect(shape({ elapsedMs: 8_000 }).speedTierLabel).toBe("Under 10s");
    expect(shape({ elapsedMs: 25_000 }).speedTierLabel).toBe("Under 30s");
    expect(answer({ mode: "NAME", elapsedMs: 8_000 }).speedTierLabel).toBe("Under 10s");
    expect(shape({ elapsedMs: 60_000 }).speedTierLabel).toBeNull();
  });

  it("can't raise the maximum score, since the bonuses themselves are unchanged", () => {
    expect(shape({ difficulty: "HARD", elapsedMs: 1_000, streak: 5 }).total).toBe(
      answer({ mode: "NAME", difficulty: "HARD", elapsedMs: 1_000, streak: 5 }).total,
    );
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
      speedTierLabel: null,
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
      speedTierLabel: "Under 5s",
    });
  });
});
