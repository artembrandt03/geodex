import { describe, expect, it } from "vitest";
import { buildPasswordResetEmail, buildVerificationEmail } from "./authEmails";
import { generateToken, hashToken } from "./tokenCrypto";

const url = "https://geodex.example/verify-email?token=abc_123-XYZ";

describe("account emails", () => {
  it("put the link in both the text and the HTML", () => {
    for (const mail of [
      buildVerificationEmail({ displayName: "Ana", url }),
      buildPasswordResetEmail({ displayName: "Ana", url }),
    ]) {
      expect(mail.text).toContain(url);
      expect(mail.html).toContain(`href="${url}"`);
    }
  });

  it("escape a hostile display name in the HTML but not the plain text", () => {
    const mail = buildVerificationEmail({ displayName: `<script>alert("x")</script>`, url });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.text).toContain("<script>");
  });

  it("escape the link too, so a query string can't break out of the attribute", () => {
    const mail = buildPasswordResetEmail({ displayName: "Ana", url: `https://x.test/?a=1&b="2"` });
    expect(mail.html).toContain("a=1&amp;b=&quot;2&quot;");
  });
});

describe("tokens", () => {
  it("are long, URL-safe and different every time", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("are stored only as a stable SHA-256 hash", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});
