"use client";

import Image from "next/image";
import { STREAK_BONUS_THRESHOLD, streakBonusFor } from "@/lib/game/scoring";

/**
 * The answer streak: under the question card on wide screens, between the
 * question card and the score on phones (see PlayGame). Appears with
 * the first correct answer, then heats up: from the bonus threshold on the
 * flame glows and the badge says what the next correct answer is worth.
 * `unoptimized` per the WebP-alpha caution in CLAUDE.md (transparent PNG).
 */
export function StreakBadge({ streak }: { streak: number }) {
  if (streak < 1) return null;

  const hot = streak >= STREAK_BONUS_THRESHOLD;
  const hint = hot
    ? `Next correct answer: +${streakBonusFor(streak + 1)} bonus`
    : `${STREAK_BONUS_THRESHOLD - streak} more in a row for bonus points`;

  return (
    <div
      // Remounting on each change replays the bump animation.
      key={streak}
      aria-label={`Streak of ${streak}`}
      style={hot ? { borderColor: "var(--warning)" } : undefined}
      className={`pointer-events-auto flex w-fit items-center gap-2 rounded-xl border bg-surface/85 py-1.5 pl-2 pr-3 shadow-lg sm:gap-3 sm:py-2 sm:pl-3 sm:pr-4 backdrop-blur-md animate-score-bump ${
        hot ? "border-2 shadow-[0_0_18px_var(--warning)]" : ""
      }`}
    >
      <Image
        src="/images/streak-fire.png"
        alt=""
        width={26}
        height={38}
        unoptimized
        className={`h-7 w-auto sm:h-[38px] ${
          hot ? "drop-shadow-[0_0_6px_rgba(249,115,22,0.8)]" : "opacity-70 grayscale-[40%]"
        }`}
      />
      <div className="flex flex-col leading-tight">
        <span className="font-display text-lg font-bold tabular-nums">
          {streak}
          <span className="ml-1 hidden text-xs font-semibold uppercase tracking-wide text-muted min-[400px]:inline">
            streak
          </span>
        </span>
        {/* The hint is too wide for a phone's top bar. */}
        <span className={`hidden text-xs sm:block ${hot ? "font-semibold text-warning" : "text-muted"}`}>{hint}</span>
      </div>
    </div>
  );
}
