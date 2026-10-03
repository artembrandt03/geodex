import type { Difficulty, GameMode } from "@/generated/prisma/client";
import type { ScoreBreakdown } from "./scoring";

export const ROUND_LENGTHS = [5, 10, 15, 20] as const;
export type RoundLength = (typeof ROUND_LENGTHS)[number];

/** How many ranked rows a leaderboard shows (the page pads unfilled ones). */
export const LEADERBOARD_SIZE = 5;

export interface RoundConfig {
  mode: GameMode;
  difficulty: Difficulty;
  roundLength: RoundLength;
}

/** A single question in a round: the target country to guess. */
export interface RoundQuestion {
  code: string;
  name: string;
}

/** Outcome of one answered question, computed client-side. */
export interface QuestionOutcome {
  /** The target's code — used to highlight the correct country on the map. */
  code: string;
  /** What the player actually guessed (null if unresolved/no match), for the feedback message. */
  guessedCode: string | null;
  correct: boolean;
  /** A wrong guess that borders the target (earns the neighbor bonus). */
  neighbor: boolean;
  /** Consecutive correct answers including this one; 0 when this one was wrong. */
  streak: number;
  /** Total points for this question, i.e. breakdown.total. */
  score: number;
  /** Where the points came from, for the reveal banner and the results history. */
  breakdown: ScoreBreakdown;
  elapsedMs: number;
}
