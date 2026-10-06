import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getHistoryPage } from "@/lib/profile/data";

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

  return NextResponse.json(await getHistoryPage(session.user.id, parsed.data.page), {
    headers: { "Cache-Control": "no-store" },
  });
}
