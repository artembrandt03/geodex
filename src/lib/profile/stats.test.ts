import { describe, expect, it } from "vitest";
import { computeStats, type RoundRecord } from "./stats";

const round = (overrides: Partial<RoundRecord> = {}): RoundRecord => ({
  mode: "NAME",
  difficulty: "EASY",
  roundLength: 5,
  score: 100,
  correct: 4,
  totalTimeMs: 60_000,
  bestStreak: 3,
  neighborCount: 1,
  ...overrides,
});

describe("computeStats", () => {
  it("is empty and null-safe with no rounds", () => {
    const stats = computeStats([]);
    expect(stats.roundsPlayed).toBe(0);
    expect(stats.accuracy).toBeNull();
    expect(stats.bestScore).toBeNull();
    expect(stats.averageTimePerCountryMs).toBeNull();
    expect(stats.fastestRounds).toEqual([]);
  });

  it("totals scores, countries, neighbors and picks the best streak", () => {
    const stats = computeStats([
      round({ score: 100, correct: 4, bestStreak: 3, neighborCount: 1 }),
      round({ score: 250, correct: 5, bestStreak: 5, neighborCount: 0 }),
    ]);
    expect(stats.roundsPlayed).toBe(2);
    expect(stats.totalScore).toBe(350);
    expect(stats.countriesGuessed).toBe(9);
    expect(stats.questionsAnswered).toBe(10);
    expect(stats.accuracy).toBeCloseTo(0.9);
    expect(stats.neighborGuesses).toBe(1);
    expect(stats.bestStreak).toBe(5);
  });

  it("remembers the highest-scoring round and where it was played", () => {
    const stats = computeStats([
      round({ score: 100 }),
      round({ score: 400, mode: "SHAPE", difficulty: "HARD", roundLength: 10 }),
    ]);
    expect(stats.bestScore).toEqual({ score: 400, mode: "SHAPE", difficulty: "HARD", roundLength: 10 });
  });

  it("keeps the fastest timed round per length, ignoring untimed rounds", () => {
    const stats = computeStats([
      round({ roundLength: 5, totalTimeMs: 70_000 }),
      round({ roundLength: 5, totalTimeMs: 50_000 }),
      round({ roundLength: 5, totalTimeMs: 0 }),
      round({ roundLength: 10, totalTimeMs: 120_000 }),
    ]);
    expect(stats.fastestRounds).toEqual([
      { roundLength: 5, timeMs: 50_000 },
      { roundLength: 10, timeMs: 120_000 },
    ]);
  });

  it("measures time only over rounds that recorded it", () => {
    const stats = computeStats([
      round({ roundLength: 5, totalTimeMs: 50_000 }),
      round({ roundLength: 5, totalTimeMs: 0 }),
    ]);
    expect(stats.totalTimeMs).toBe(50_000);
    expect(stats.averageTimePerCountryMs).toBe(10_000);
  });

  it("splits accuracy by difficulty and mode", () => {
    const stats = computeStats([
      round({ difficulty: "EASY", correct: 5, mode: "NAME" }),
      round({ difficulty: "HARD", correct: 1, mode: "SHAPE" }),
      round({ difficulty: "HARD", correct: 2, mode: "SHAPE" }),
    ]);
    expect(stats.byDifficulty.EASY).toEqual({ rounds: 1, correct: 5, questions: 5 });
    expect(stats.byDifficulty.HARD).toEqual({ rounds: 2, correct: 3, questions: 10 });
    expect(stats.byDifficulty.MEDIUM).toEqual({ rounds: 0, correct: 0, questions: 0 });
    expect(stats.byMode.SHAPE.rounds).toBe(2);
  });
});
