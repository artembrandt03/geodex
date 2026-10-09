import { describe, expect, it } from "vitest";
import { END_REASON_COPY, INACTIVITY_LIMIT_MS, INACTIVITY_WARNING_MS, msUntilInactive } from "./antiCheat";

describe("msUntilInactive", () => {
  it("counts down from the full minute", () => {
    expect(msUntilInactive(1_000, 1_000)).toBe(INACTIVITY_LIMIT_MS);
    expect(msUntilInactive(1_000, 31_000)).toBe(30_000);
  });

  it("bottoms out at 0 rather than going negative", () => {
    expect(msUntilInactive(0, INACTIVITY_LIMIT_MS)).toBe(0);
    expect(msUntilInactive(0, INACTIVITY_LIMIT_MS + 5_000)).toBe(0);
  });
});

describe("constants and copy", () => {
  it("warns inside the limit", () => {
    expect(INACTIVITY_WARNING_MS).toBeLessThan(INACTIVITY_LIMIT_MS);
  });

  it("has an explanation for every end reason", () => {
    expect(END_REASON_COPY.left_tab.body).toMatch(/fair/i);
    expect(END_REASON_COPY.inactive.body).toMatch(/60 seconds/);
  });
});
