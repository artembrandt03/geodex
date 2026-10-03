import { ROUND_LENGTHS } from "../game/types";

export type ProfileMode = "NAME" | "SHAPE";
export type ProfileDifficulty = "EASY" | "MEDIUM" | "HARD";

/** The columns of a saved round that the profile's stats are built from. */
export interface RoundRecord {
  mode: ProfileMode;
  difficulty: ProfileDifficulty;
  roundLength: number;
  score: number;
  correct: number;
  /** 0 on rounds saved before the stopwatch existed: unknown, so left out of time stats. */
  totalTimeMs: number;
  bestStreak: number;
  neighborCount: number;
}

export interface AccuracyBucket {
  rounds: number;
  correct: number;
  questions: number;
}

export interface ProfileStats {
  roundsPlayed: number;
  totalScore: number;
  bestScore: { score: number; mode: ProfileMode; difficulty: ProfileDifficulty; roundLength: number } | null;
  /** Countries guessed correctly, across every round. */
  countriesGuessed: number;
  questionsAnswered: number;
  /** 0 to 1; null before any round. */
  accuracy: number | null;
  neighborGuesses: number;
  bestStreak: number;
  /** Time spent answering, over rounds that recorded it. */
  totalTimeMs: number;
  /** Mean time per answered country, over rounds that recorded time; null if none did. */
  averageTimePerCountryMs: number | null;
  /** Fastest finished round for each round length that has a timed round. */
  fastestRounds: { roundLength: number; timeMs: number }[];
  byDifficulty: Record<ProfileDifficulty, AccuracyBucket>;
  byMode: Record<ProfileMode, AccuracyBucket>;
}

const emptyBucket = (): AccuracyBucket => ({ rounds: 0, correct: 0, questions: 0 });

function addTo(bucket: AccuracyBucket, round: RoundRecord) {
  bucket.rounds += 1;
  bucket.correct += round.correct;
  bucket.questions += round.roundLength;
}

export function computeStats(rounds: RoundRecord[]): ProfileStats {
  const stats: ProfileStats = {
    roundsPlayed: rounds.length,
    totalScore: 0,
    bestScore: null,
    countriesGuessed: 0,
    questionsAnswered: 0,
    accuracy: null,
    neighborGuesses: 0,
    bestStreak: 0,
    totalTimeMs: 0,
    averageTimePerCountryMs: null,
    fastestRounds: [],
    byDifficulty: { EASY: emptyBucket(), MEDIUM: emptyBucket(), HARD: emptyBucket() },
    byMode: { NAME: emptyBucket(), SHAPE: emptyBucket() },
  };

  let timedQuestions = 0;
  const fastest = new Map<number, number>();

  for (const round of rounds) {
    stats.totalScore += round.score;
    stats.countriesGuessed += round.correct;
    stats.questionsAnswered += round.roundLength;
    stats.neighborGuesses += round.neighborCount;
    stats.bestStreak = Math.max(stats.bestStreak, round.bestStreak);
    addTo(stats.byDifficulty[round.difficulty], round);
    addTo(stats.byMode[round.mode], round);

    if (!stats.bestScore || round.score > stats.bestScore.score) {
      stats.bestScore = {
        score: round.score,
        mode: round.mode,
        difficulty: round.difficulty,
        roundLength: round.roundLength,
      };
    }

    if (round.totalTimeMs > 0) {
      stats.totalTimeMs += round.totalTimeMs;
      timedQuestions += round.roundLength;
      const best = fastest.get(round.roundLength);
      if (best === undefined || round.totalTimeMs < best) {
        fastest.set(round.roundLength, round.totalTimeMs);
      }
    }
  }

  if (stats.questionsAnswered > 0) stats.accuracy = stats.countriesGuessed / stats.questionsAnswered;
  if (timedQuestions > 0) stats.averageTimePerCountryMs = stats.totalTimeMs / timedQuestions;

  stats.fastestRounds = ROUND_LENGTHS.flatMap((roundLength) => {
    const timeMs = fastest.get(roundLength);
    return timeMs === undefined ? [] : [{ roundLength, timeMs }];
  });

  return stats;
}
