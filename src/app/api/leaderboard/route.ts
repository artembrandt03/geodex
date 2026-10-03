import { NextResponse } from "next/server";
import { z } from "zod";
import { getLeaderboard } from "@/lib/leaderboard";
import { ROUND_LENGTHS } from "@/lib/game/types";

const querySchema = z.object({
  mode: z.enum(["NAME", "SHAPE"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  roundLength: z.coerce
    .number()
    .int()
    .refine((n) => (ROUND_LENGTHS as readonly number[]).includes(n)),
});

/** Returns the top players' best scores for a given mode/difficulty/roundLength. */
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

  const results = await getLeaderboard({ mode, difficulty, roundLength });

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
