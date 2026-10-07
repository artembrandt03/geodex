import { describe, expect, it } from "vitest";
import { ROUND_TOKEN_MAX_AGE_MS, issueRoundToken, verifyRoundToken } from "./roundToken";

const round = { mode: "SHAPE", difficulty: "HARD", roundLength: 15 } as const;

describe("round tokens", () => {
  it("round-trips the round's details and start time", () => {
    const token = issueRoundToken(round, 1_000_000);
    const payload = verifyRoundToken(token, 1_000_000 + 5_000);
    expect(payload).toMatchObject({ ...round, issuedAt: 1_000_000 });
    expect(payload?.id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("gives every round its own id", () => {
    const a = verifyRoundToken(issueRoundToken(round));
    const b = verifyRoundToken(issueRoundToken(round));
    expect(a?.id).not.toBe(b?.id);
  });

  it("rejects a token whose payload was edited", () => {
    const token = issueRoundToken(round, 1_000_000);
    const [encoded, signature] = token.split(".");
    const forged = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    forged.roundLength = 5; // pretend it was a different round
    const reEncoded = Buffer.from(JSON.stringify(forged)).toString("base64url");
    expect(verifyRoundToken(`${reEncoded}.${signature}`, 1_000_001)).toBeNull();
  });

  it("rejects a token with a wrong or missing signature", () => {
    const token = issueRoundToken(round, 1_000_000);
    const [encoded] = token.split(".");
    expect(verifyRoundToken(`${encoded}.AAAA`, 1_000_001)).toBeNull();
    expect(verifyRoundToken(encoded, 1_000_001)).toBeNull();
    expect(verifyRoundToken("", 1_000_001)).toBeNull();
    expect(verifyRoundToken("not.a.token.at.all", 1_000_001)).toBeNull();
  });

  it("rejects an expired token and one dated in the future", () => {
    const token = issueRoundToken(round, 5_000_000);
    expect(verifyRoundToken(token, 5_000_000 + ROUND_TOKEN_MAX_AGE_MS)).not.toBeNull();
    expect(verifyRoundToken(token, 5_000_000 + ROUND_TOKEN_MAX_AGE_MS + 1)).toBeNull();
    expect(verifyRoundToken(token, 4_999_999)).toBeNull();
  });
});
