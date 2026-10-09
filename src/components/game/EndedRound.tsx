"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { END_REASON_COPY, type RoundEndReason } from "@/lib/game/antiCheat";

/**
 * Shown instead of the results when a round is stopped early (the player left
 * the tab, or a question sat unanswered for a minute). It says why, and what
 * was answered so far, but the round isn't saved to the leaderboard.
 */
export function EndedRound({
  reason,
  answered,
  roundLength,
  totalScore,
  signedIn,
  onPlayAgain,
}: {
  reason: RoundEndReason;
  answered: number;
  roundLength: number;
  totalScore: number;
  signedIn: boolean;
  onPlayAgain: () => void;
}) {
  const copy = END_REASON_COPY[reason];

  return (
    <motion.div
      role="alertdialog"
      aria-labelledby="round-ended-title"
      aria-describedby="round-ended-body"
      initial={{ opacity: 0, scale: 0.94, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className="mx-4 flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-4 rounded-2xl border border-border bg-surface px-6 py-6 text-center shadow-2xl"
    >
      <h1 id="round-ended-title" className="font-display text-2xl font-bold">
        {copy.title}
      </h1>
      <p id="round-ended-body" className="text-sm leading-relaxed text-muted">
        {copy.body}
      </p>
      <p className="text-sm">
        You answered{" "}
        <strong>
          {answered} of {roundLength}
        </strong>{" "}
        and had <strong>{totalScore}</strong> {totalScore === 1 ? "point" : "points"}.{" "}
        <span className="text-muted">
          {signedIn
            ? "An unfinished round doesn't count toward the leaderboard."
            : "An unfinished round doesn't count."}
        </span>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <motion.button
          type="button"
          onClick={onPlayAgain}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
        >
          Play again
        </motion.button>
        <Link
          href="/setup"
          className="rounded-lg border border-border-strong px-5 py-2.5 text-center font-semibold"
        >
          Back to setup
        </Link>
      </div>
    </motion.div>
  );
}
