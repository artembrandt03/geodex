import type { Difficulty, GameMode } from "@/generated/prisma/client";

/**
 * Per-question scoring. There is no hard time limit; a correct answer is
 * always worth its base points, with bonuses on top.
 *
 *  - Base points by difficulty: Easy 10, Medium 20, Hard 30.
 *  - Speed bonus (correct answers only): a share of the base points for
 *    answering within the first 5s (+100%), 10s (+50%) or 15s (+25%).
 *    Slower than 15s earns just the base. Shape mode, where you have to
 *    type the name, gets double the time: 10s, 20s and 30s.
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
 * (Not bumped for the shape-mode time windows widening, 2026-10-07: that was
 * before launch and only ever raised shape-mode scores.)
 */
export const SCORING_VERSION = 2;

export const BASE_POINTS: Record<Difficulty, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 30,
};

/** The speed tiers as they are for name mode; see speedTiersFor for a given mode. Fastest first. */
export const SPEED_TIERS = [
  { maxMs: 5_000, multiplier: 1, label: "Under 5s" },
  { maxMs: 10_000, multiplier: 0.5, label: "Under 10s" },
  { maxMs: 15_000, multiplier: 0.25, label: "Under 15s" },
] as const;

/**
 * Typing a country's name takes longer than finding it on the map, so each
 * speed window is this many times longer in shape mode. The bonuses
 * themselves (+100%, +50%, +25%) are the same, so the maximum score is too.
 */
export const SPEED_WINDOW_SCALE: Record<GameMode, number> = {
  NAME: 1,
  SHAPE: 2,
};

export interface SpeedTier {
  maxMs: number;
  multiplier: number;
  /** e.g. "Under 10s". */
  label: string;
}

/** The speed tiers for a mode, fastest first. */
export function speedTiersFor(mode: GameMode): SpeedTier[] {
  const scale = SPEED_WINDOW_SCALE[mode];
  return SPEED_TIERS.map((tier) => {
    const maxMs = tier.maxMs * scale;
    return { maxMs, multiplier: tier.multiplier, label: `Under ${maxMs / 1000}s` };
  });
}

export const STREAK_BONUS_THRESHOLD = 3;
export const STREAK_BONUS_START = 5;
export const NEIGHBOR_BONUS = 1;

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  streakBonus: number;
  neighborBonus: number;
  total: number;
  /** The speed window this answer fell in ("Under 10s"), or null if it earned no speed bonus. */
  speedTierLabel: string | null;
}

export interface ScoreInput {
  mode: GameMode;
  difficulty: Difficulty;
  correct: boolean;
  /** A wrong guess that borders the target. Ignored when `correct`. */
  neighbor: boolean;
  elapsedMs: number;
  /** Consecutive correct answers including this one (0 when this one is wrong). */
  streak: number;
}

/** The speed tier an answer fell into, or null when it was too slow for any. */
export function speedTierFor(elapsedMs: number, mode: GameMode): SpeedTier | null {
  return speedTiersFor(mode).find((tier) => elapsedMs <= tier.maxMs) ?? null;
}

/** Streak bonus for a run of this length: 0 below the threshold, then 5, 6, 7, ... */
export function streakBonusFor(streak: number): number {
  if (streak < STREAK_BONUS_THRESHOLD) return 0;
  return STREAK_BONUS_START + (streak - STREAK_BONUS_THRESHOLD);
}

export function scoreAnswer({
  mode,
  difficulty,
  correct,
  neighbor,
  elapsedMs,
  streak,
}: ScoreInput): ScoreBreakdown {
  if (!correct) {
    const neighborBonus = neighbor ? NEIGHBOR_BONUS : 0;
    return {
      base: 0,
      speedBonus: 0,
      streakBonus: 0,
      neighborBonus,
      total: neighborBonus,
      speedTierLabel: null,
    };
  }

  const base = BASE_POINTS[difficulty];
  const tier = speedTierFor(elapsedMs, mode);
  const speedBonus = tier ? Math.round(base * tier.multiplier) : 0;
  const streakBonus = streakBonusFor(streak);

  return {
    base,
    speedBonus,
    streakBonus,
    neighborBonus: 0,
    total: base + speedBonus + streakBonus,
    speedTierLabel: tier?.label ?? null,
  };
}
