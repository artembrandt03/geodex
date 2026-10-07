import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeaderboard } from "@/lib/leaderboard";
import { SCORING_VERSION } from "@/lib/game/scoring";
import { checkRoundPlausible } from "@/lib/game/plausibility";
import { ROUND_LENGTHS } from "@/lib/game/types";

// A round can't take longer than a day.
const MAX_ROUND_MS = 24 * 60 * 60 * 1000;
// Hard ceilings so absurd numbers fail validation here instead of overflowing the
// database's 32-bit integer columns (which used to be a 500). The best possible
// round is about 1,450 points over 20 countries; checkRoundPlausible does the
// precise check below.
const MAX_SCORE = 10_000;
const MAX_COUNT = Math.max(...ROUND_LENGTHS);

const completeRoundSchema = z.object({
  mode: z.enum(["NAME", "SHAPE"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  roundLength: z
    .number()
    .int()
    .refine((n) => (ROUND_LENGTHS as readonly number[]).includes(n)),
  score: z.number().int().min(0).max(MAX_SCORE),
  correct: z.number().int().min(0).max(MAX_COUNT),
  totalTimeMs: z.number().int().min(0).max(MAX_ROUND_MS),
  bestStreak: z.number().int().min(0).max(MAX_COUNT),
  neighborCount: z.number().int().min(0).max(MAX_COUNT),
});

/**
 * Persists a finished round for the signed-in user and reports where it
 * placed on the leaderboard (`leaderboardRank`, 1-based, or null). Guests
 * never call this -- their results simply aren't saved, per the guest-play
 * spec.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = completeRoundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid result" },
      { status: 400 },
    );
  }

  const { mode, difficulty, roundLength, score, correct, totalTimeMs, bestStreak, neighborCount } =
    parsed.data;

  // The round is scored in the browser, so reject anything the scoring rules
  // make impossible (a forged score, a streak longer than the round, a round
  // finished faster than a person can play). The reason is logged, but the
  // reply stays generic so it doesn't coach anyone on what to adjust.
  const verdict = checkRoundPlausible(parsed.data);
  if (!verdict.ok) {
    console.warn(`[rounds/complete] rejected a round from ${session.user.id}: ${verdict.reason}`);
    return NextResponse.json({ error: "That result doesn't look right." }, { status: 400 });
  }

  const gameResult = await prisma.gameResult.create({
    data: {
      userId: session.user.id,
      mode,
      difficulty,
      roundLength,
      score,
      correct,
      totalTimeMs,
      bestStreak,
      neighborCount,
      scoringVersion: SCORING_VERSION,
    },
  });

  // On the board only if THIS round is the player's entry in the top N (their
  // best run), not merely because an older run of theirs already was.
  const board = await getLeaderboard({ mode, difficulty, roundLength });
  const index = board.findIndex((entry) => entry.id === gameResult.id);

  return NextResponse.json(
    { gameResult, leaderboardRank: index === -1 ? null : index + 1 },
    { status: 201 },
  );
}
