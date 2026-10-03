import type { Difficulty } from "@/generated/prisma/client";

/**
 * Per-question scoring. There is no hard time limit; a correct answer is
 * always worth its base points, with bonuses on top.
 *
 *  - Base points by difficulty: Easy 10, Medium 20, Hard 30.
 *  - Speed bonus (correct answers only): a share of the base points for
 *    answering within the first 5s (+100%), 10s (+50%) or 15s (+25%).
 *    Slower than 15s earns just the base.
 *  - Streak bonus (correct answers only): once 3 answers in a row are
 *    correct the 3rd earns +5, and every further correct answer in the run
 *    earns 1 more than the one before (+6, +7, ...). A wrong answer ends
 *    the run.
 *  - Neighbor bonus: a wrong answer that is a country bordering the right
 *    one still earns +1, as consolation (it does not keep a streak alive).
 *  - Anything else wrong (or no answer): 0.
 *
 * Bumping SCORING_VERSION keeps old rounds off the leaderboards when the
 * numbers change, since scores from different rules aren't comparable.
 */
export const SCORING_VERSION = 2;

export const BASE_POINTS: Record<Difficulty, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 30,
};

/** Fastest tier first; an answer earns the first tier whose cutoff it beats. */
export const SPEED_TIERS = [
  { maxMs: 5_000, multiplier: 1, label: "Under 5s" },
  { maxMs: 10_000, multiplier: 0.5, label: "Under 10s" },
  { maxMs: 15_000, multiplier: 0.25, label: "Under 15s" },
] as const;

export const STREAK_BONUS_THRESHOLD = 3;
export const STREAK_BONUS_START = 5;
export const NEIGHBOR_BONUS = 1;

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  streakBonus: number;
  neighborBonus: number;
  total: number;
}

export interface ScoreInput {
  difficulty: Difficulty;
  correct: boolean;
  /** A wrong guess that borders the target. Ignored when `correct`. */
  neighbor: boolean;
  elapsedMs: number;
  /** Consecutive correct answers including this one (0 when this one is wrong). */
  streak: number;
}

/** The speed tier an answer fell into, or null when it was too slow for any. */
export function speedTierFor(elapsedMs: number) {
  return SPEED_TIERS.find((tier) => elapsedMs <= tier.maxMs) ?? null;
}

/** Streak bonus for a run of this length: 0 below the threshold, then 5, 6, 7, ... */
export function streakBonusFor(streak: number): number {
  if (streak < STREAK_BONUS_THRESHOLD) return 0;
  return STREAK_BONUS_START + (streak - STREAK_BONUS_THRESHOLD);
}

export function scoreAnswer({
  difficulty,
  correct,
  neighbor,
  elapsedMs,
  streak,
}: ScoreInput): ScoreBreakdown {
  if (!correct) {
    const neighborBonus = neighbor ? NEIGHBOR_BONUS : 0;
    return { base: 0, speedBonus: 0, streakBonus: 0, neighborBonus, total: neighborBonus };
  }

  const base = BASE_POINTS[difficulty];
  const tier = speedTierFor(elapsedMs);
  const speedBonus = tier ? Math.round(base * tier.multiplier) : 0;
  const streakBonus = streakBonusFor(streak);

  return {
    base,
    speedBonus,
    streakBonus,
    neighborBonus: 0,
    total: base + speedBonus + streakBonus,
  };
}
