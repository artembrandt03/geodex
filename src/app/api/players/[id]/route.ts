import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserStats } from "@/lib/profile/data";
import { canViewProfile } from "@/lib/profile/visibility";

/**
 * Another player's profile, as shown from the leaderboard: name, join date
 * and stats, never their email. Private profiles are refused (403) for
 * everyone but their owner.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, user] = await Promise.all([
    auth(),
    prisma.user.findUnique({
      where: { id },
      select: { id: true, displayName: true, createdAt: true, profilePublic: true },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  if (!canViewProfile(user, session?.user?.id)) {
    return NextResponse.json({ error: "This profile is private" }, { status: 403 });
  }

  return NextResponse.json(
    {
      user: { displayName: user.displayName, createdAt: user.createdAt, profilePublic: user.profilePublic },
      isSelf: session?.user?.id === user.id,
      stats: await getUserStats(user.id),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
