import type { ScoreBreakdown } from "./scoring";

export type PointPartKind = "base" | "speed" | "streak" | "neighbor";

export interface PointPart {
  kind: PointPartKind;
  /** Short chip text: "Base", "Speed", "Streak", "Neighbor". */
  label: string;
  /** Longer explanation for the results history: "Answered in under 5s". */
  detail: string;
  points: number;
}

/** The non-zero pieces of a question's score, in the order they're earned. */
export function breakdownParts(
  breakdown: ScoreBreakdown,
  context: { elapsedMs: number; streak: number },
): PointPart[] {
  const parts: PointPart[] = [];

  if (breakdown.base > 0) {
    parts.push({ kind: "base", label: "Base", detail: "Correct answer", points: breakdown.base });
  }
  if (breakdown.speedBonus > 0) {
    parts.push({
      kind: "speed",
      label: "Speed",
      detail: breakdown.speedTierLabel
        ? `Answered ${breakdown.speedTierLabel.toLowerCase()}`
        : "Quick answer",
      points: breakdown.speedBonus,
    });
  }
  if (breakdown.streakBonus > 0) {
    parts.push({
      kind: "streak",
      label: "Streak",
      detail: `${context.streak} correct in a row`,
      points: breakdown.streakBonus,
    });
  }
  if (breakdown.neighborBonus > 0) {
    parts.push({
      kind: "neighbor",
      label: "Neighbor",
      detail: "Wrong, but it borders the answer",
      points: breakdown.neighborBonus,
    });
  }

  return parts;
}
