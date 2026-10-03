import { describe, expect, it } from "vitest";
import { formatDuration, formatStopwatch, totalTimeMs } from "./time";

describe("totalTimeMs", () => {
  it("sums the answered questions' times", () => {
    expect(totalTimeMs([])).toBe(0);
    expect(totalTimeMs([{ elapsedMs: 1200 }, { elapsedMs: 3400 }])).toBe(4600);
  });
});

describe("formatStopwatch", () => {
  it("shows minutes, seconds and tenths", () => {
    expect(formatStopwatch(0)).toBe("0:00.0");
    expect(formatStopwatch(7_450)).toBe("0:07.4");
    expect(formatStopwatch(65_900)).toBe("1:05.9");
    expect(formatStopwatch(723_000)).toBe("12:03.0");
    expect(formatStopwatch(-5)).toBe("0:00.0");
  });
});

describe("formatDuration", () => {
  it("picks a compact unit", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45_400)).toBe("45s");
    expect(formatDuration(192_000)).toBe("3m 12s");
    expect(formatDuration(7_500_000)).toBe("2h 05m");
  });
});
