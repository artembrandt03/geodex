import { NextResponse } from "next/server";
import { z } from "zod";
import { ROUND_LENGTHS } from "@/lib/game/types";
import { pickRoundCountries } from "@/lib/game/countrySelection";
import { issueRoundToken } from "@/lib/game/roundToken";

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

  try {
    const questions = await pickRoundCountries(difficulty, roundLength);
    // The token is what lets /api/rounds/complete know this round really was started here.
    return NextResponse.json({
      questions,
      token: issueRoundToken({ mode, difficulty, roundLength }),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not start round" }, { status: 500 });
  }
}
