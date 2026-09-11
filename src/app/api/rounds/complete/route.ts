import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROUND_LENGTHS } from "@/lib/game/types";

const completeRoundSchema = z.object({
  mode: z.enum(["NAME", "SHAPE"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  roundLength: z
    .number()
    .int()
    .refine((n) => (ROUND_LENGTHS as readonly number[]).includes(n)),
  score: z.number().int().min(0),
  correct: z.number().int().min(0),
});

/**
 * Persists a finished round for the signed-in user. Guests never call this
 * — their results simply aren't saved, per the guest-play spec.
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

  const { mode, difficulty, roundLength, score, correct } = parsed.data;

  if (correct > roundLength) {
    return NextResponse.json({ error: "correct exceeds roundLength" }, { status: 400 });
  }

  const gameResult = await prisma.gameResult.create({
    data: {
      userId: session.user.id,
      mode,
      difficulty,
      roundLength,
      score,
      correct,
    },
  });

  return NextResponse.json({ gameResult }, { status: 201 });
}
