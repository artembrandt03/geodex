import { describe, expect, it } from "vitest";
import { changePasswordSchema } from "./password";

const parse = (currentPassword: string, newPassword: string) =>
  changePasswordSchema.safeParse({ currentPassword, newPassword });

describe("changePasswordSchema", () => {
  it("accepts a different password of 8+ characters", () => {
    expect(parse("oldpassword", "brandnewpass").success).toBe(true);
  });

  it("requires the current password", () => {
    const result = parse("", "brandnewpass");
    expect(result.success).toBe(false);
  });

  it("rejects a short new password with a helpful message", () => {
    const result = parse("oldpassword", "short");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/at least 8/);
  });

  it("rejects reusing the current password", () => {
    const result = parse("samepassword", "samepassword");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/different/);
  });
});
