import {
  BASE_POINTS,
  NEIGHBOR_BONUS,
  SPEED_TIERS,
  STREAK_BONUS_THRESHOLD,
  streakBonusFor,
} from "./scoring";
import { INACTIVITY_LIMIT_MS } from "./antiCheat";
import type { Difficulty, GameMode } from "@/generated/prisma/client";

/**
 * Rounds are played and scored in the browser, so the server can't trust a
 * submitted result. It can, though, reject one that is *impossible* under the
 * scoring rules, which is what this file does. It can't tell a legitimate
 * perfect round from a script that claims one with believable numbers (the
 * answers are in the start response); only server-side scoring closes that.
 * What it does stop is the cheap forgery: a made-up score, a streak longer
 * than the round, a 20-country round "finished" in a second.
 */

export interface RoundClaim {
  mode: GameMode;
  difficulty: Difficulty;
  roundLength: number;
  score: number;
  correct: number;
  totalTimeMs: number;
  bestStreak: number;
  neighborCount: number;
}

export type RoundVerdict = { ok: true } | { ok: false; reason: string };

/**
 * The least time a person can plausibly spend per question: read, find or
 * type, commit. Deliberately generous (a fast expert on an easy country takes
 * about a second), because rejecting an honest player is worse than letting a
 * barely-too-fast round through.
 */
export const MIN_MS_PER_QUESTION: Record<GameMode, number> = {
  NAME: 500,
  SHAPE: 800,
};

/**
 * The most time one question can take: the client ends the round when one is
 * left open for INACTIVITY_LIMIT_MS, so a finished round can't contain a longer
 * one. A few seconds of slack cover a click landing just as the limit hits.
 */
export const MAX_MS_PER_QUESTION = INACTIVITY_LIMIT_MS + 5_000;

/** Total streak bonus earned by one unbroken run of this many correct answers. */
function runBonus(length: number): number {
  let total = 0;
  for (let k = STREAK_BONUS_THRESHOLD; k <= length; k++) total += streakBonusFor(k);
  return total;
}

/**
 * The most streak bonus `correct` right answers can earn if no run is longer
 * than `bestStreak`. The bonus grows faster than linearly with run length, so
 * the max packs the answers into as many full-length runs as fit plus one
 * shorter run. (It ignores that runs need a wrong answer between them, which
 * only makes this an upper bound, never too low.)
 */
export function maxStreakBonus(correct: number, bestStreak: number): number {
  if (bestStreak < STREAK_BONUS_THRESHOLD || correct <= 0) return 0;
  const fullRuns = Math.floor(correct / bestStreak);
  const remainder = correct % bestStreak;
  return fullRuns * runBonus(bestStreak) + runBonus(remainder);
}

/** Lowest and highest score a round with these results can have. */
export function scoreBounds(
  claim: Pick<RoundClaim, "difficulty" | "correct" | "bestStreak" | "neighborCount">,
) {
  const base = BASE_POINTS[claim.difficulty];
  const bestSpeedBonus = Math.round(base * SPEED_TIERS[0].multiplier);
  const neighborPoints = claim.neighborCount * NEIGHBOR_BONUS;
  return {
    // Every right answer earns its base at least, every close wrong guess its point.
    min: claim.correct * base + neighborPoints,
    // ...and at most base + the top speed bonus, plus whatever streaks allow.
    max:
      claim.correct * (base + bestSpeedBonus) +
      maxStreakBonus(claim.correct, claim.bestStreak) +
      neighborPoints,
  };
}

export function checkRoundPlausible(claim: RoundClaim): RoundVerdict {
  const { roundLength, correct, bestStreak, neighborCount, score, totalTimeMs } = claim;
  const wrong = roundLength - correct;

  if (correct < 0 || correct > roundLength) return fail("correct is outside the round");
  if (neighborCount < 0 || neighborCount > wrong) {
    return fail("more neighbor guesses than wrong answers");
  }

  // The longest run can't exceed the right answers, and with `wrong` misses
  // splitting them into at most wrong + 1 runs, it can't be shorter than an even split.
  if (bestStreak > correct) return fail("streak longer than the correct count");
  if (correct > 0 && bestStreak < Math.ceil(correct / (wrong + 1))) {
    return fail("streak too short for the correct count");
  }
  if (correct === 0 && bestStreak !== 0) return fail("a streak with no correct answers");

  const { min, max } = scoreBounds(claim);
  if (score < min) return fail(`score ${score} below the minimum ${min}`);
  if (score > max) return fail(`score ${score} above the maximum ${max}`);

  const minTime = roundLength * MIN_MS_PER_QUESTION[claim.mode];
  if (totalTimeMs < minTime) return fail(`time ${totalTimeMs}ms under the minimum ${minTime}ms`);

  const maxTime = roundLength * MAX_MS_PER_QUESTION;
  if (totalTimeMs > maxTime) return fail(`time ${totalTimeMs}ms over the maximum ${maxTime}ms`);

  return { ok: true };
}

function fail(reason: string): RoundVerdict {
  return { ok: false, reason };
}
