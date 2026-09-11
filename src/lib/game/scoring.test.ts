import { describe, expect, it } from "vitest";
import { scoreGuess } from "./scoring";

describe("scoreGuess", () => {
  it("awards 0 for an incorrect guess regardless of time", () => {
    expect(scoreGuess(false, 0)).toBe(0);
    expect(scoreGuess(false, 1_000)).toBe(0);
    expect(scoreGuess(false, 60_000)).toBe(0);
  });

  it("awards max score for a correct guess within 5 seconds", () => {
    expect(scoreGuess(true, 0)).toBe(50);
    expect(scoreGuess(true, 2_500)).toBe(50);
    expect(scoreGuess(true, 5_000)).toBe(50);
  });

  it("linearly decays between 5s and 30s", () => {
    // Halfway through the 25s decay window (5s -> 30s) should be halfway
    // between 50 and 25.
    expect(scoreGuess(true, 17_500)).toBe(38); // Math.round(37.5)
  });

  it("floors at 25 points no matter how long it takes, as long as correct", () => {
    expect(scoreGuess(true, 30_000)).toBe(25);
    expect(scoreGuess(true, 120_000)).toBe(25);
    expect(scoreGuess(true, 10_000_000)).toBe(25);
  });
});
