import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCORING_VERSION } from "@/lib/game/scoring";
import { computeStats } from "@/lib/profile/stats";

/** The signed-in player's account details and lifetime stats (current scoring rules only). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [user, rounds] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { displayName: true, email: true, createdAt: true },
    }),
    prisma.gameResult.findMany({
      where: { userId: session.user.id, scoringVersion: SCORING_VERSION },
      select: {
        mode: true,
        difficulty: true,
        roundLength: true,
        score: true,
        correct: true,
        totalTimeMs: true,
        bestStreak: true,
        neighborCount: true,
      },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json(
    { user, stats: computeStats(rounds) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
