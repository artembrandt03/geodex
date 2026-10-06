import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCORING_VERSION } from "@/lib/game/scoring";
import { computeStats } from "@/lib/profile/stats";
import { displayNameSchema } from "@/lib/profile/displayName";

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

const updateSchema = z.object({ displayName: displayNameSchema });

/** Changes the signed-in player's display name (same rules as at signup). */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid display name" },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { displayName: parsed.data.displayName },
    select: { displayName: true },
  });

  return NextResponse.json({ displayName: user.displayName });
}

const deleteSchema = z.object({ password: z.string().min(1, "Enter your password to confirm") });

/**
 * Permanently deletes the signed-in player's account. Needs the current
 * password (a still-signed-in session on its own shouldn't be able to wipe
 * an account). Their rounds go with them (GameResult cascades); any feedback
 * they sent stays, with the link to them cleared (SetNull).
 */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter your password to confirm" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!matches) {
    return NextResponse.json({ error: "That password isn't right" }, { status: 403 });
  }

  await prisma.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ ok: true });
}
