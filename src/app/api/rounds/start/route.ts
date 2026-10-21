import { NextResponse } from "next/server";
import { z } from "zod";
import { ROUND_LENGTHS } from "@/lib/game/types";
import { pickRoundCountries } from "@/lib/game/countrySelection";
import { issueRoundToken, verifyRoundToken } from "@/lib/game/roundToken";
import { auth } from "@/lib/auth";
import { clientIp, hashKey } from "@/lib/clientIp";
import { checkRateLimit, minutesUntil, recordHit } from "@/lib/rateLimit";
import { roundStartRule } from "@/lib/authLimits";
import { recordRoundEvent } from "@/lib/analytics/rounds";
import { touchActivity, track } from "@/lib/analytics/track";

const startRoundSchema = z.object({
  mode: z.enum(["NAME", "SHAPE"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  roundLength: z
    .number()
    .int()
    .refine((n) => (ROUND_LENGTHS as readonly number[]).includes(n), {
      message: `roundLength must be one of ${ROUND_LENGTHS.join(", ")}`,
    }),
});

/**
 * Starts a round by picking the target countries server-side. The full
 * question list (code + name) is returned up front and the round is played
 * out entirely client-side — see CLAUDE.md's "known simplifications" note
 * on why answers aren't withheld per-question for this MVP.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = startRoundSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid round config" },
      { status: 400 },
    );
  }

  const { mode, difficulty, roundLength } = parsed.data;

  // Each start writes an anonymous event, so it's limited per IP (see authLimits).
  const ip = clientIp(request);
  if (ip) {
    const rule = roundStartRule(hashKey(ip));
    const state = await checkRateLimit(rule);
    if (state.limited) {
      await track("round.start_limited");
      const minutes = minutesUntil(state.retryAfterMs);
      return NextResponse.json(
        { error: `You're starting rounds very quickly. Please wait ${minutes} ${minutes === 1 ? "minute" : "minutes"}.` },
        { status: 429 },
      );
    }
    await recordHit(rule.bucket, rule.key);
  }

  try {
    const questions = await pickRoundCountries(difficulty, roundLength);
    // The token is what lets /api/rounds/complete know this round really was started here.
    const token = issueRoundToken({ mode, difficulty, roundLength });

    // For the owner's statistics: an anonymous "started" event (guests included), and a
    // signed-in player is marked active today.
    const session = await auth();
    await recordRoundEvent({
      roundId: verifyRoundToken(token)!.id,
      kind: "STARTED",
      mode,
      difficulty,
      roundLength,
      signedIn: Boolean(session?.user?.id),
    });
    if (session?.user?.id) await touchActivity(session.user.id);

    return NextResponse.json({ questions, token });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not start round" }, { status: 500 });
  }
}
