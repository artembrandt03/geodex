import { breakdownParts, type PointPartKind } from "@/lib/game/breakdown";
import type { QuestionOutcome } from "@/lib/game/types";

const CHIP_STYLES: Record<PointPartKind, string> = {
  base: "border-border-strong bg-surface-2 text-foreground",
  speed: "border-accent-strong bg-accent/15 text-primary-hover",
  streak: "bg-warning/15 text-warning",
  neighbor: "border-border-strong bg-surface-2 text-muted",
};

/** "Base +10  Speed +10  Streak +5": the pieces a question's score was built from. */
export function PointChips({ outcome }: { outcome: QuestionOutcome }) {
  const parts = breakdownParts(outcome.breakdown, outcome);
  if (parts.length === 0) return null;

  return (
    <ul className="flex flex-wrap justify-center gap-1.5">
      {parts.map((part) => (
        <li
          key={part.kind}
          // Inline: globals.css's unlayered `* { border-color }` beats border-<color> classes.
          style={part.kind === "streak" ? { borderColor: "var(--warning)" } : undefined}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CHIP_STYLES[part.kind]}`}
        >
          <span className="uppercase tracking-wide opacity-80">{part.label}</span>
          <span className="tabular-nums">+{part.points}</span>
        </li>
      ))}
    </ul>
  );
}
