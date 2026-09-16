import type { Difficulty, GameMode } from "@/generated/prisma/client";

export const ROUND_LENGTHS = [5, 10, 15, 20] as const;
export type RoundLength = (typeof ROUND_LENGTHS)[number];

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
  score: number;
  elapsedMs: number;
}
