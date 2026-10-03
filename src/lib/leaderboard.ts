import { prisma } from "@/lib/prisma";
import { SCORING_VERSION } from "@/lib/game/scoring";
import { LEADERBOARD_SIZE } from "@/lib/game/types";
import type { Difficulty, GameMode } from "@/generated/prisma/client";

export interface LeaderboardFilters {
  mode: GameMode;
  difficulty: Difficulty;
  roundLength: number;
}

/**
 * The top players' best runs for one mode/difficulty/round length, under the
 * current scoring rules only. `distinct userId` keeps each player's best run;
 * ties go to whoever got there first, so podium spots are stable rather than
 * shuffling between equal scores on every request.
 */
export async function getLeaderboard(filters: LeaderboardFilters) {
  return prisma.gameResult.findMany({
    where: { ...filters, scoringVersion: SCORING_VERSION },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    distinct: ["userId"],
    take: LEADERBOARD_SIZE,
    select: {
      id: true,
      userId: true,
      score: true,
      correct: true,
      createdAt: true,
      user: { select: { displayName: true } },
    },
  });
}
