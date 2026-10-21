import type { Difficulty, GameMode, RoundEndReason, RoundEventKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Anonymous round lifecycle events (see RoundEvent in the schema): a round started,
 * finished, or ended early. Keyed by the round's own random id, so each kind is
 * recorded once per round however many times it's reported. No user, no IP, no browser.
 * Best effort, like all the statistics: a failure here never affects the game.
 */
export interface RoundEventInput {
  roundId: string;
  kind: RoundEventKind;
  mode: GameMode;
  difficulty: Difficulty;
  roundLength: number;
  signedIn: boolean;
  endReason?: RoundEndReason;
  answered?: number;
  durationMs?: number;
}

export async function recordRoundEvent(event: RoundEventInput): Promise<void> {
  try {
    await prisma.roundEvent.createMany({
      data: [
        {
          roundId: event.roundId,
          kind: event.kind,
          mode: event.mode,
          difficulty: event.difficulty,
          roundLength: event.roundLength,
          signedIn: event.signedIn,
          endReason: event.endReason ?? null,
          answered: event.answered ?? null,
          durationMs: event.durationMs ?? null,
        },
      ],
      skipDuplicates: true,
    });
  } catch (error) {
    console.error("[analytics] could not record a round event", error);
  }
}
