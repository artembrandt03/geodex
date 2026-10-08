import type { EmailTokenKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";
import { generateToken, hashToken } from "@/lib/tokenCrypto";

/** Single-use links we email: confirm an address, or reset a password. See tokenCrypto.ts for how the tokens are made and stored. */

const HOUR = 60 * 60 * 1000;

export const TOKEN_TTL_MS: Record<EmailTokenKind, number> = {
  VERIFY_EMAIL: 24 * HOUR,
  // Shorter, since a reset link is a way into the account.
  RESET_PASSWORD: 1 * HOUR,
};

/** A fresh link token for a user, replacing any earlier one of the same kind (only the newest email works). */
export async function issueToken(userId: string, kind: EmailTokenKind): Promise<string> {
  const token = generateToken();
  await prisma.$transaction([
    prisma.emailToken.deleteMany({ where: { userId, kind } }),
    prisma.emailToken.create({
      data: {
        userId,
        kind,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS[kind]),
      },
    }),
  ]);
  return token;
}

/**
 * Uses up a token: returns the user it belongs to, or null if it's unknown,
 * the wrong kind, expired or already used. The delete is what makes it single
 * use, and its count is checked so two simultaneous clicks can't both win.
 */
export async function consumeToken(token: string, kind: EmailTokenKind): Promise<string | null> {
  const tokenHash = hashToken(token);
  const row = await prisma.emailToken.findUnique({ where: { tokenHash } });
  if (!row || row.kind !== kind || row.expiresAt.getTime() <= Date.now()) return null;

  const { count } = await prisma.emailToken.deleteMany({ where: { id: row.id } });
  return count === 1 ? row.userId : null;
}

/** Throws old, never-used tokens away. Called now and then from the endpoints that issue them. */
export async function sweepExpiredTokens(): Promise<void> {
  await prisma.emailToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

export function verifyEmailUrl(token: string): string {
  return `${siteUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

export function resetPasswordUrl(token: string): string {
  return `${siteUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}
