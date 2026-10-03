import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCORING_VERSION } from "@/lib/game/scoring";

const HISTORY_PAGE_SIZE = 10;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

/** One page (10 rounds, newest first) of the signed-in player's match history. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    page: new URL(request.url).searchParams.get("page") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }
  const { page } = parsed.data;

  const where = { userId: session.user.id, scoringVersion: SCORING_VERSION };
  const [total, rounds] = await Promise.all([
    prisma.gameResult.count({ where }),
    prisma.gameResult.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
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

  return NextResponse.json(
    {
      rounds,
      page,
      pageSize: HISTORY_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
