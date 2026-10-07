import { describe, expect, it } from "vitest";
import {
  LOGIN_EMAIL_BUCKET,
  LOGIN_IP_BUCKET,
  loginRules,
  parseRateLimitedCode,
  rateLimitedMessage,
} from "./authLimits";

describe("loginRules", () => {
  it("limits by email and by IP", () => {
    const rules = loginRules("email-hash", "ip-hash");
    expect(rules.map((r) => [r.bucket, r.key])).toEqual([
      [LOGIN_EMAIL_BUCKET, "email-hash"],
      [LOGIN_IP_BUCKET, "ip-hash"],
    ]);
  });

  it("skips the IP rule when there's no IP", () => {
    expect(loginRules("email-hash", null).map((r) => r.bucket)).toEqual([LOGIN_EMAIL_BUCKET]);
  });

  it("is stricter per account than per IP", () => {
    const [email, ip] = loginRules("a", "b");
    expect(email.limit).toBeLessThan(ip.limit);
  });
});

describe("rate limit error codes", () => {
  it("reads the minutes back out of a code", () => {
    expect(parseRateLimitedCode("rate_limited_12")).toBe(12);
    expect(parseRateLimitedCode("rate_limited_1")).toBe(1);
  });

  it("ignores anything else", () => {
    expect(parseRateLimitedCode("credentials")).toBeNull();
    expect(parseRateLimitedCode(undefined)).toBeNull();
    expect(parseRateLimitedCode("rate_limited_")).toBeNull();
    expect(parseRateLimitedCode("rate_limited_abc")).toBeNull();
    expect(parseRateLimitedCode("rate_limited_0")).toBeNull();
  });

  it("words the wait in minutes", () => {
    expect(rateLimitedMessage(1)).toBe("Too many failed attempts. Please try again in 1 minute.");
    expect(rateLimitedMessage(14)).toBe("Too many failed attempts. Please try again in 14 minutes.");
  });
});
