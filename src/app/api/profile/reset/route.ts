import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const resetSchema = z.object({ password: z.string().min(1, "Enter your password to confirm") });

/**
 * Wipes every saved round for the signed-in player (all scoring versions),
 * so their stats, match history and leaderboard places start again from
 * zero. The account itself stays. Needs the current password, like deleting
 * the account does.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
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

  const { count } = await prisma.gameResult.deleteMany({ where: { userId: session.user.id } });

  return NextResponse.json({ ok: true, deleted: count });
}
