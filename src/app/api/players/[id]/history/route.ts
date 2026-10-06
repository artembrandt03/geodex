import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHistoryPage } from "@/lib/profile/data";
import { canViewProfile } from "@/lib/profile/visibility";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

/** One page of another player's match history, under the same visibility rule as their profile. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = querySchema.safeParse({
    page: new URL(request.url).searchParams.get("page") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }

  const [session, user] = await Promise.all([
    auth(),
    prisma.user.findUnique({ where: { id }, select: { id: true, profilePublic: true } }),
  ]);
  if (!user) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  if (!canViewProfile(user, session?.user?.id)) {
    return NextResponse.json({ error: "This profile is private" }, { status: 403 });
  }

  return NextResponse.json(await getHistoryPage(user.id, parsed.data.page), {
    headers: { "Cache-Control": "no-store" },
  });
}
