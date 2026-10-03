"use client";

import { useEffect, useState } from "react";
import { formatStopwatch, totalTimeMs } from "@/lib/game/time";

/**
 * The round's stopwatch: time spent answering so far. It runs while a
 * question is open and holds still on the reveal screen, so reading the
 * result (or zooming around the map) doesn't cost anything; a finished
 * round just shows its total.
 */
export function RoundStopwatch({
  outcomes,
  startedAt,
  running,
}: {
  outcomes: { elapsedMs: number }[];
  /** When the open question was shown (ms epoch); null when none is open. */
  startedAt: number | null;
  running: boolean;
}) {
  // Only ever set from the interval callback; 0 until the first tick, and a
  // stale value from the previous question just clamps to 0 below.
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [running]);

  const live = running && startedAt !== null ? Math.max(0, now - startedAt) : 0;

  return (
    <div className="flex items-center gap-1.5 text-muted" title="Time spent answering">
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        aria-hidden
        className="h-4 w-4"
      >
        <circle cx="10" cy="11.5" r="6" />
        <path d="M10 11.5V8.5M8 3h4M15 5.5l1.2-1.2" />
      </svg>
      <span className="font-display text-sm font-semibold tabular-nums text-foreground">
        {formatStopwatch(totalTimeMs(outcomes) + live)}
      </span>
    </div>
  );
}
