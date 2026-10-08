import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, hashKey } from "@/lib/clientIp";
import { checkRateLimit, minutesUntil, recordHit } from "@/lib/rateLimit";
import { emailSendRules, type AccountEmailKind } from "@/lib/authLimits";
import { issueToken, resetPasswordUrl, sweepExpiredTokens, verifyEmailUrl } from "@/lib/emailTokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/authEmails";
import { getSmtpConfig } from "@/lib/mail";

/** Server-side plumbing shared by the signup, resend, forgot-password and reset endpoints. */

/** Emails are stored and compared lowercased, so "Ana@Gmail.com" and "ana@gmail.com" are one account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Case-insensitive, so accounts created before emails were lowercased are still found. */
export function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: normalizeEmail(email), mode: "insensitive" } } });
}

/**
 * Counts this request against the per-address and per-IP email allowance and
 * returns a 429 response if either is used up (null if it may go ahead).
 * Called before looking the account up, so the outcome never depends on
 * whether the address has an account.
 */
export async function limitAccountEmails(
  request: Request,
  email: string,
  kind: AccountEmailKind,
): Promise<NextResponse | null> {
  const ip = clientIp(request);
  const rules = emailSendRules(kind, hashKey(normalizeEmail(email)), ip ? hashKey(ip) : null);
  for (const rule of rules) {
    const state = await checkRateLimit(rule);
    if (state.limited) {
      const minutes = minutesUntil(state.retryAfterMs);
      return NextResponse.json(
        { error: `Too many emails requested. Please try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.` },
        { status: 429 },
      );
    }
  }
  await Promise.all(rules.map((rule) => recordHit(rule.bucket, rule.key)));
  return null;
}

interface Recipient {
  id: string;
  email: string;
  displayName: string;
}

/**
 * Delivers a link. Without SMTP configured, local development prints the link
 * to the server console so the flow can still be tried; production refuses
 * (throws), so a signup can't silently end up with no way to confirm.
 */
async function deliver(send: () => Promise<void>, label: string, to: string, url: string) {
  if (getSmtpConfig()) return send();
  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev] SMTP isn't configured; ${label} link for ${to}: ${url}`);
    return;
  }
  throw new Error("Email is not configured.");
}

/** Issues a fresh confirmation link and emails it. Throws if the email can't be sent. */
export async function sendVerification(user: Recipient): Promise<void> {
  const url = verifyEmailUrl(await issueToken(user.id, "VERIFY_EMAIL"));
  await deliver(() => sendVerificationEmail(user.email, user.displayName, url), "confirmation", user.email, url);
  if (Math.random() < 0.05) await sweepExpiredTokens();
}

/** Issues a fresh password reset link and emails it. Throws if the email can't be sent. */
export async function sendPasswordReset(user: Recipient): Promise<void> {
  const url = resetPasswordUrl(await issueToken(user.id, "RESET_PASSWORD"));
  await deliver(() => sendPasswordResetEmail(user.email, user.displayName, url), "password reset", user.email, url);
  if (Math.random() < 0.05) await sweepExpiredTokens();
}
