import { createHash, randomBytes } from "node:crypto";

/**
 * The pure half of the emailed-link tokens (see emailTokens.ts for the
 * database half). The raw token only ever exists in the email and the URL;
 * the database keeps a SHA-256 of it, so a leaked table can't be turned into
 * working links. A plain hash is enough: tokens are 256 random bits, not
 * guessable passwords.
 */

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
