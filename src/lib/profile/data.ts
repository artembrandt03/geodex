import { prisma } from "@/lib/prisma";
import { SCORING_VERSION } from "@/lib/game/scoring";
import { computeStats } from "./stats";

export const HISTORY_PAGE_SIZE = 10;

const roundSelect = {
  mode: true,
  difficulty: true,
  roundLength: true,
  score: true,
  correct: true,
  totalTimeMs: true,
  bestStreak: true,
  neighborCount: true,
} as const;

/** Lifetime stats for one player, over rounds scored under the current rules. */
export async function getUserStats(userId: string) {
  const rounds = await prisma.gameResult.findMany({
    where: { userId, scoringVersion: SCORING_VERSION },
    select: roundSelect,
  });
  return computeStats(rounds);
}

/** One page of a player's rounds, newest first. */
export async function getHistoryPage(userId: string, page: number) {
  const where = { userId, scoringVersion: SCORING_VERSION };
  const [total, rounds] = await Promise.all([
    prisma.gameResult.count({ where }),
    prisma.gameResult.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      select: { id: true, createdAt: true, ...roundSelect },
    }),
  ]);

  return {
    rounds,
    page,
    pageSize: HISTORY_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
  };
}
