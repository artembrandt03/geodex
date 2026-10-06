import { describe, expect, it } from "vitest";
import { displayNameSchema } from "./displayName";

describe("displayNameSchema", () => {
  it("accepts and trims an ordinary name", () => {
    expect(displayNameSchema.parse("  Artem  ")).toBe("Artem");
  });

  it("enforces the length limits", () => {
    expect(displayNameSchema.safeParse("A").success).toBe(false);
    expect(displayNameSchema.safeParse("   ").success).toBe(false);
    expect(displayNameSchema.safeParse("A".repeat(30)).success).toBe(true);
    expect(displayNameSchema.safeParse("A".repeat(31)).success).toBe(false);
  });

  it("rejects profanity, including simple character swaps", () => {
    const result = displayNameSchema.safeParse("sh1t");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/isn't allowed/);
  });
});
