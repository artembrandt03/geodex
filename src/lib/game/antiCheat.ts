/**
 * Rules that keep a round honest and moving. A question left unanswered for
 * a minute ends the round (nobody is playing, or somebody is looking the
 * answer up), and so does leaving the tab while a question is open. These are
 * client-side deterrents: they stop the casual lookup, not a determined
 * script, which is why the server also bounds what a finished round can claim
 * (see plausibility.ts).
 */

/** How long one question may stay open before the round ends. */
export const INACTIVITY_LIMIT_MS = 60_000;

/** The last stretch of that minute, when the player is warned the round is about to end. */
export const INACTIVITY_WARNING_MS = 15_000;

export type RoundEndReason = "left_tab" | "inactive";

/** Time left on the open question, 0 once it's up. `startedAt` is when it was shown (ms epoch). */
export function msUntilInactive(startedAt: number, now: number): number {
  return Math.max(0, INACTIVITY_LIMIT_MS - (now - startedAt));
}

/** What the round-ended card tells the player. */
export const END_REASON_COPY: Record<RoundEndReason, { title: string; body: string }> = {
  left_tab: {
    title: "Round ended",
    body: "You left the game tab while a question was open. Rounds end when you switch tabs or windows, so please don't look answers up. Play fair and give it another go!",
  },
  inactive: {
    title: "Round ended",
    body: "A question went unanswered for 60 seconds, so the round was ended. Start a new one whenever you're ready.",
  },
};
