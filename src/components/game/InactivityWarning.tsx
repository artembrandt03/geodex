"use client";

import { useEffect, useState } from "react";
import { INACTIVITY_WARNING_MS, msUntilInactive } from "@/lib/game/antiCheat";

/**
 * Appears for the last seconds of a question's minute, so the round ending for
 * inactivity is never a surprise. Silent until then. The seconds are hidden from
 * screen readers (they'd be re-announced every tick); the sentence beside them
 * is announced once, when the warning first appears.
 */
export function InactivityWarning({
  startedAt,
  active,
}: {
  /** When the open question was shown (ms epoch). */
  startedAt: number | null;
  active: boolean;
}) {
  // Only ever set from the interval callback, like RoundStopwatch's clock.
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active || startedAt === null || now === 0) return null;
  const remaining = msUntilInactive(startedAt, now);
  // A stale `now` from the previous question can't show a warning for this one.
  if (now < startedAt || remaining > INACTIVITY_WARNING_MS) return null;

  return (
    <p role="status" className="text-xs font-medium text-danger">
      Answer soon or the round ends{" "}
      <span aria-hidden className="tabular-nums">
        ({Math.ceil(remaining / 1000)}s)
      </span>
    </p>
  );
}
