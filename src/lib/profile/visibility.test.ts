import { describe, expect, it } from "vitest";
import { canViewProfile } from "./visibility";

describe("canViewProfile", () => {
  const publicUser = { id: "u1", profilePublic: true };
  const privateUser = { id: "u2", profilePublic: false };

  it("lets anyone, signed in or not, open a public profile", () => {
    expect(canViewProfile(publicUser, null)).toBe(true);
    expect(canViewProfile(publicUser, undefined)).toBe(true);
    expect(canViewProfile(publicUser, "someone-else")).toBe(true);
  });

  it("keeps a private profile from everyone but its owner", () => {
    expect(canViewProfile(privateUser, null)).toBe(false);
    expect(canViewProfile(privateUser, "someone-else")).toBe(false);
    expect(canViewProfile(privateUser, "u2")).toBe(true);
  });
});
