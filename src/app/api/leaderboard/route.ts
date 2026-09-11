import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROUND_LENGTHS } from "@/lib/game/types";

const querySchema = z.object({
  mode: z.enum(["NAME", "SHAPE"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  roundLength: z.coerce
    .number()
    .int()
    .refine((n) => (ROUND_LENGTHS as readonly number[]).includes(n)),
});

const LEADERBOARD_SIZE = 20;

/** Returns each player's best score for a given mode/difficulty/roundLength. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    mode: searchParams.get("mode"),
    difficulty: searchParams.get("difficulty"),
    roundLength: searchParams.get("roundLength"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 },
    );
  }

  const { mode, difficulty, roundLength } = parsed.data;

  // distinct on userId, ordered by score desc, keeps each player's best run.
  const results = await prisma.gameResult.findMany({
    where: { mode, difficulty, roundLength },
    orderBy: { score: "desc" },
    distinct: ["userId"],
    take: LEADERBOARD_SIZE,
    select: {
      score: true,
      correct: true,
      createdAt: true,
      user: { select: { displayName: true } },
    },
  });

  return NextResponse.json({
    entries: results.map((r, i) => ({
      rank: i + 1,
      displayName: r.user.displayName,
      score: r.score,
      correct: r.correct,
      createdAt: r.createdAt,
    })),
  });
}
