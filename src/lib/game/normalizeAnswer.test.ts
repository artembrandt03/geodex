import { describe, expect, it } from "vitest";
import { normalizeAnswer } from "./normalizeAnswer";

describe("normalizeAnswer", () => {
  it("lowercases and trims", () => {
    expect(normalizeAnswer("  Canada  ")).toBe("canada");
  });

  it("treats accented and unaccented spellings as equal", () => {
    expect(normalizeAnswer("Côte d'Ivoire")).toBe(normalizeAnswer("Cote d'Ivoire"));
  });

  it("ignores punctuation differences", () => {
    expect(normalizeAnswer("Guinea-Bissau")).toBe(normalizeAnswer("Guinea Bissau"));
    expect(normalizeAnswer("Timor-Leste")).toBe(normalizeAnswer("Timor Leste"));
  });

  it("collapses extra whitespace", () => {
    expect(normalizeAnswer("United   States")).toBe("united states");
  });
});
