import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { verifyRoundToken } from "@/lib/game/roundToken";
import { recordRoundEvent } from "@/lib/analytics/rounds";
import { touchActivity } from "@/lib/analytics/track";
import { ROUND_LENGTHS } from "@/lib/game/types";

const MAX_QUESTIONS = Math.max(...ROUND_LENGTHS);

const eventSchema = z.object({
  roundToken: z.string().min(1).max(1_000),
  kind: z.enum(["finished", "ended"]),
  reason: z.enum(["left_tab", "inactive"]).optional(),
  answered: z.number().int().min(0).max(MAX_QUESTIONS),
});

/**
 * Reports how a round ended, for the owner's statistics: it was finished, or it was
 * ended early (and why). Open to guests as well as signed-in players, because the
 * point is to see all rounds. The signed round token proves a real round was started
 * here, so it can't be invented from nothing, and each outcome is recorded once per
 * round however often it is sent. Nothing about the player is stored: no account, no
 * address, no browser.
 */
export async function POST(request: Request) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const { roundToken, kind, reason, answered } = parsed.data;

  const token = verifyRoundToken(roundToken);
  if (!token || answered > token.roundLength) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  if (kind === "ended" && !reason) return NextResponse.json({ error: "Invalid event" }, { status: 400 });

  const session = await auth();
  await recordRoundEvent({
    roundId: token.id,
    kind: kind === "finished" ? "FINISHED" : "ENDED",
    mode: token.mode,
    difficulty: token.difficulty,
    roundLength: token.roundLength,
    signedIn: Boolean(session?.user?.id),
    endReason: kind === "ended" ? (reason === "left_tab" ? "LEFT_TAB" : "INACTIVE") : undefined,
    answered,
    // Measured by the server from when the round was issued, not taken from the browser.
    durationMs: Math.min(Date.now() - token.issuedAt, 24 * 60 * 60 * 1000),
  });
  if (session?.user?.id) await touchActivity(session.user.id);

  return new NextResponse(null, { status: 204 });
}
