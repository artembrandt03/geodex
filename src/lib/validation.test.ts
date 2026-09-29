import { describe, expect, it } from "vitest";
import { containsProfanity } from "./validation";

describe("containsProfanity", () => {
  it("flags profane words", () => {
    expect(containsProfanity("shit")).toBe(true);
  });

  it("flags common leetspeak/character-substitution evasions", () => {
    expect(containsProfanity("sh1t")).toBe(true);
  });

  it("allows ordinary display names", () => {
    expect(containsProfanity("Artem")).toBe(false);
    expect(containsProfanity("GeoMaster42")).toBe(false);
  });
});
