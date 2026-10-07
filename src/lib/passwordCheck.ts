import bcrypt from "bcryptjs";
import { hashKey } from "@/lib/clientIp";
import { passwordCheckRule, PASSWORD_CHECK_BUCKET } from "@/lib/authLimits";
import { checkRateLimit, clearHits, minutesUntil, recordHit } from "@/lib/rateLimit";

export type PasswordCheckResult =
  | { ok: true }
  | { ok: false; reason: "wrong" }
  | { ok: false; reason: "limited"; minutes: number };

/**
 * Checks a signed-in user's current password for an action that needs it,
 * with the failed attempts limited per user. The limit is checked first so a
 * locked-out user can't keep guessing, a wrong password counts against it, and
 * a right one wipes the count.
 */
export async function checkCurrentPassword(
  userId: string,
  passwordHash: string,
  password: string,
): Promise<PasswordCheckResult> {
  const rule = passwordCheckRule(hashKey(userId));

  const state = await checkRateLimit(rule);
  if (state.limited) return { ok: false, reason: "limited", minutes: minutesUntil(state.retryAfterMs) };

  if (!(await bcrypt.compare(password, passwordHash))) {
    await recordHit(rule.bucket, rule.key);
    return { ok: false, reason: "wrong" };
  }

  await clearHits(PASSWORD_CHECK_BUCKET, rule.key);
  return { ok: true };
}

/** The 429 message for a locked-out password check. */
export function passwordLimitedMessage(minutes: number): string {
  return `Too many wrong passwords. Please try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}
