import type { RateLimitRule } from "./rateLimit";

const MINUTE = 60_000;

/**
 * Failed-login allowance. Two independent limits, because they stop different
 * attacks: per email stops anyone (from any number of IPs) guessing one
 * account's password; per IP stops one machine trying lots of accounts. The
 * email limit means someone can deliberately lock a victim out for the
 * window, which is the standard trade-off and only lasts a quarter of an
 * hour; a correct login clears the email's count.
 */
export const LOGIN_FAILURES_PER_EMAIL = 5;
export const LOGIN_FAILURES_PER_IP = 20;
export const LOGIN_WINDOW_MS = 15 * MINUTE;

export const LOGIN_EMAIL_BUCKET = "login-fail:email";
export const LOGIN_IP_BUCKET = "login-fail:ip";

/** The rules a login attempt is checked against; the IP rule is skipped when no IP is known (plain local dev). */
export function loginRules(emailKey: string, ipKey: string | null): RateLimitRule[] {
  const rules: RateLimitRule[] = [
    {
      bucket: LOGIN_EMAIL_BUCKET,
      key: emailKey,
      limit: LOGIN_FAILURES_PER_EMAIL,
      windowMs: LOGIN_WINDOW_MS,
    },
  ];
  if (ipKey) {
    rules.push({
      bucket: LOGIN_IP_BUCKET,
      key: ipKey,
      limit: LOGIN_FAILURES_PER_IP,
      windowMs: LOGIN_WINDOW_MS,
    });
  }
  return rules;
}

/**
 * Signup allowance per IP: generous enough for a family or a classroom
 * behind one address, tight enough to stop a script from minting accounts
 * (or probing which emails are taken, since a taken email is reported).
 * Every attempt that gets past validation counts, successful or not.
 */
export const SIGNUPS_PER_IP = 10;
export const SIGNUP_WINDOW_MS = 60 * MINUTE;
export const SIGNUP_IP_BUCKET = "signup:ip";

export function signupRule(ipKey: string): RateLimitRule {
  return { bucket: SIGNUP_IP_BUCKET, key: ipKey, limit: SIGNUPS_PER_IP, windowMs: SIGNUP_WINDOW_MS };
}

/**
 * Wrong-password allowance on the actions that ask for the current password
 * (change password, reset statistics, delete account), per signed-in user.
 * Without it, someone on a hijacked or left-open session could guess the
 * password there with no limit, even though login itself is throttled.
 */
export const PASSWORD_CHECK_FAILURES = 5;
export const PASSWORD_CHECK_WINDOW_MS = 15 * MINUTE;
export const PASSWORD_CHECK_BUCKET = "password-check:user";

export function passwordCheckRule(userKey: string): RateLimitRule {
  return {
    bucket: PASSWORD_CHECK_BUCKET,
    key: userKey,
    limit: PASSWORD_CHECK_FAILURES,
    windowMs: PASSWORD_CHECK_WINDOW_MS,
  };
}

/** Prefix of the error code the login form looks for; the minutes to wait follow it. */
export const RATE_LIMITED_CODE_PREFIX = "rate_limited_";

export function rateLimitedMessage(minutes: number): string {
  return `Too many failed attempts. Please try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

/** Reads the wait from a sign-in error code, or null if it isn't a rate-limit code. */
export function parseRateLimitedCode(code: string | null | undefined): number | null {
  if (!code?.startsWith(RATE_LIMITED_CODE_PREFIX)) return null;
  const minutes = Number(code.slice(RATE_LIMITED_CODE_PREFIX.length));
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null;
}
