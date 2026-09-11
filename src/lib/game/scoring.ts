/**
 * Per-question scoring. No hard time limit — a correct guess always scores
 * something, decaying from a max down to a floor the longer it takes.
 *
 *  - 0-5s:   flat 50 points (max).
 *  - 5-30s:  linearly decays from 50 down to 25.
 *  - 30s+:   floor of 25 points, however long it takes.
 *  - Wrong guess (or no guess): 0 points, regardless of time.
 */
const MAX_SCORE = 50;
const MIN_SCORE = 25;
const FULL_SCORE_WINDOW_MS = 5_000;
const DECAY_WINDOW_MS = 25_000; // spans from the 5s mark to the 30s mark

export function scoreGuess(correct: boolean, elapsedMs: number): number {
  if (!correct) return 0;
  if (elapsedMs <= FULL_SCORE_WINDOW_MS) return MAX_SCORE;

  const overage = elapsedMs - FULL_SCORE_WINDOW_MS;
  const decayFraction = Math.min(overage / DECAY_WINDOW_MS, 1);
  return Math.round(MAX_SCORE - decayFraction * (MAX_SCORE - MIN_SCORE));
}
