/** The pure half of the daily email budget (see emailBudget.ts for the database half). */

export const DEFAULT_DAILY_EMAIL_BUDGET = 400;
/** The ceiling: EMAIL_DAILY_LIMIT if it's a positive whole number, else the default. */
export function dailyEmailBudget(env: string | undefined = process.env.EMAIL_DAILY_LIMIT): number {
  const n = Number(env);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAILY_EMAIL_BUDGET;
}

/** Whether another email may go out given how many already did, and whether to warn that the budget is nearly gone. Pure. */
export function budgetStatus(used: number, limit: number): { allowed: boolean; nearLimit: boolean } {
  return { allowed: used < limit, nearLimit: used >= Math.floor(limit * 0.8) };
}
