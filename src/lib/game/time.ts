/** Time spent answering: the sum of each answered question's time (pauses on the reveal screen don't count). */
export function totalTimeMs(outcomes: { elapsedMs: number }[]): number {
  return outcomes.reduce((sum, o) => sum + o.elapsedMs, 0);
}

/** Stopwatch style, to the tenth: 0:07.4, 12:03.0. */
export function formatStopwatch(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}

/** Compact for totals and stats: 45s, 3m 12s, 2h 05m. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}
