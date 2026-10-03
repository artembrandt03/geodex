import { describe, expect, it } from "vitest";
import { breakdownParts } from "./breakdown";
import { scoreAnswer } from "./scoring";

describe("breakdownParts", () => {
  it("lists base, speed and streak for a fast answer on a streak", () => {
    const elapsedMs = 3_000;
    const b = scoreAnswer({ difficulty: "EASY", correct: true, neighbor: false, elapsedMs, streak: 4 });
    const parts = breakdownParts(b, { elapsedMs, streak: 4 });
    expect(parts.map((p) => [p.kind, p.points])).toEqual([
      ["base", 10],
      ["speed", 10],
      ["streak", 6],
    ]);
    expect(parts[1].detail).toBe("Answered under 5s");
    expect(parts[2].detail).toBe("4 correct in a row");
    expect(parts.reduce((sum, p) => sum + p.points, 0)).toBe(b.total);
  });

  it("omits bonuses that weren't earned", () => {
    const b = scoreAnswer({ difficulty: "HARD", correct: true, neighbor: false, elapsedMs: 40_000, streak: 1 });
    expect(breakdownParts(b, { elapsedMs: 40_000, streak: 1 }).map((p) => p.kind)).toEqual(["base"]);
  });

  it("shows only the neighbor bonus for a close wrong guess", () => {
    const b = scoreAnswer({ difficulty: "EASY", correct: false, neighbor: true, elapsedMs: 2_000, streak: 0 });
    expect(breakdownParts(b, { elapsedMs: 2_000, streak: 0 }).map((p) => p.kind)).toEqual(["neighbor"]);
  });

  it("is empty for a plain wrong answer", () => {
    const b = scoreAnswer({ difficulty: "EASY", correct: false, neighbor: false, elapsedMs: 2_000, streak: 0 });
    expect(breakdownParts(b, { elapsedMs: 2_000, streak: 0 })).toEqual([]);
  });
});
