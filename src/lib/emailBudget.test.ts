import { describe, expect, it } from "vitest";
import { DEFAULT_DAILY_EMAIL_BUDGET, budgetStatus, dailyEmailBudget } from "./emailBudgetRules";

describe("dailyEmailBudget", () => {
  it("uses EMAIL_DAILY_LIMIT when it is a positive whole number", () => {
    expect(dailyEmailBudget("250")).toBe(250);
  });

  it("falls back to the default for anything else", () => {
    for (const bad of [undefined, "", "abc", "0", "-5", "12.5"]) {
      expect(dailyEmailBudget(bad)).toBe(DEFAULT_DAILY_EMAIL_BUDGET);
    }
  });

  it("keeps the default under Gmail's 500 a day", () => {
    expect(DEFAULT_DAILY_EMAIL_BUDGET).toBeLessThan(500);
  });
});

describe("budgetStatus", () => {
  it("allows sending until the limit is reached", () => {
    expect(budgetStatus(0, 400).allowed).toBe(true);
    expect(budgetStatus(399, 400).allowed).toBe(true);
    expect(budgetStatus(400, 400).allowed).toBe(false);
    expect(budgetStatus(900, 400).allowed).toBe(false);
  });

  it("warns from 80% of the limit", () => {
    expect(budgetStatus(319, 400).nearLimit).toBe(false);
    expect(budgetStatus(320, 400).nearLimit).toBe(true);
  });
});
