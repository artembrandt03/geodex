"use client";

import Image from "next/image";
import { STREAK_BONUS_THRESHOLD, streakBonusFor } from "@/lib/game/scoring";

/**
 * The answer streak, in the top-left under the question card. Appears with
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
      className={`pointer-events-auto flex w-fit items-center gap-3 rounded-xl border bg-surface/85 py-2 pl-3 pr-4 shadow-lg backdrop-blur-md animate-score-bump ${
        hot ? "border-2 shadow-[0_0_18px_var(--warning)]" : ""
      }`}
    >
      <Image
        src="/images/streak-fire.png"
        alt=""
        width={26}
        height={38}
        unoptimized
        className={hot ? "drop-shadow-[0_0_6px_rgba(249,115,22,0.8)]" : "opacity-70 grayscale-[40%]"}
      />
      <div className="flex flex-col leading-tight">
        <span className="font-display text-lg font-bold tabular-nums">
          {streak}
          <span className="ml-1 text-xs font-semibold uppercase tracking-wide text-muted">
            streak
          </span>
        </span>
        <span className={`text-xs ${hot ? "font-semibold text-warning" : "text-muted"}`}>{hint}</span>
      </div>
    </div>
  );
}
