import { prisma } from "@/lib/prisma";
import type { Difficulty } from "@/generated/prisma/client";
import type { RoundQuestion } from "./types";

/** Picks `roundLength` distinct random countries from the given difficulty pool. */
export async function pickRoundCountries(
  difficulty: Difficulty,
  roundLength: number,
): Promise<RoundQuestion[]> {
  const pool = await prisma.country.findMany({
    where: { difficultyTier: difficulty },
    select: { code: true, name: true },
  });

  if (pool.length < roundLength) {
    throw new Error(
      `Not enough ${difficulty} countries (${pool.length}) for a round of ${roundLength}`,
    );
  }

  // Fisher-Yates shuffle, then take the first `roundLength`.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, roundLength);
}
