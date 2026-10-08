import { prisma } from "@/lib/prisma";
import { recordHit } from "@/lib/rateLimit";
import { budgetStatus, dailyEmailBudget } from "@/lib/emailBudgetRules";

/**
 * A daily ceiling on every email the app sends (account emails and feedback
 * alike), well under the SMTP provider's own cap (Gmail allows about 500 a
 * day). The per-address and per-IP limits stop one person flooding; this stops
 * the sum, so even an attacker spread over many IPs and addresses can't use up
 * the whole allowance and leave real players' confirmation emails undeliverable.
 * Past the ceiling, sending is refused instead (account endpoints answer 503,
 * feedback is still saved, just not emailed) until the 24h window rolls on.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;
export const EMAIL_BUDGET_BUCKET = "email-budget";
const EMAIL_BUDGET_KEY = "all";

/** True while today's budget has room. Logs a warning once it's 80% spent, so a spike shows up in the server logs. */
export async function emailBudgetAvailable(): Promise<boolean> {
  const used = await prisma.rateLimitHit.count({
    where: {
      bucket: EMAIL_BUDGET_BUCKET,
      key: EMAIL_BUDGET_KEY,
      createdAt: { gt: new Date(Date.now() - WINDOW_MS) },
    },
  });
  const limit = dailyEmailBudget();
  const status = budgetStatus(used, limit);
  if (status.nearLimit) {
    console.warn(`[email] ${used} of ${limit} emails used in the last 24h${status.allowed ? "" : "; sending is paused"}`);
  }
  return status.allowed;
}

/** Counts one sent email against the budget. */
export function recordEmailSent(): Promise<void> {
  return recordHit(EMAIL_BUDGET_BUCKET, EMAIL_BUDGET_KEY);
}

export const EMAIL_BUDGET_MESSAGE =
  "We're sending a lot of email right now. Please try again in a little while.";
