import type { Page } from "@playwright/test";

export interface Q {
  code: string;
  name: string;
}

/** A few easy countries, with the codes and names exactly as the seed stores them. */
export const CUBA: Q = { code: "CUB", name: "Cuba" };
export const JAPAN: Q = { code: "JPN", name: "Japan" };
export const BRAZIL: Q = { code: "BRA", name: "Brazil" };
export const EGYPT: Q = { code: "EGY", name: "Egypt" };
export const AUSTRALIA: Q = { code: "AUS", name: "Australia" };
export const SPAIN: Q = { code: "ESP", name: "Spain" };
export const PORTUGAL: Q = { code: "PRT", name: "Portugal" };
export const FRANCE: Q = { code: "FRA", name: "France" };
export const USA: Q = { code: "USA", name: "United States of America" };

/** Five easy countries for a standard 5-question round. */
export const FIVE: Q[] = [CUBA, JAPAN, BRAZIL, EGYPT, AUSTRALIA];

/**
 * Makes the next round ask exactly these questions, in this order. The real
 * /api/rounds/start response is kept (including its signed token, so saving the
 * result still works); only the question list is swapped.
 */
export async function stubQuestions(page: Page, questions: Q[]): Promise<void> {
  await page.route("**/api/rounds/start", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, questions } });
  });
}

export type Mode = "NAME" | "SHAPE";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export function playUrl(mode: Mode, difficulty: Difficulty = "EASY", roundLength = 5): string {
  return `/play?mode=${mode}&difficulty=${difficulty}&roundLength=${roundLength}`;
}

/** Name mode: clicks a country on the map. Dispatches the click on the shape so tiny or oddly shaped countries can't be missed. */
export async function clickCountry(page: Page, code: string): Promise<void> {
  await page.locator(`path[data-code="${code}"]`).first().dispatchEvent("click");
}

/** Shape mode: types an answer and submits it. */
export async function guessShape(page: Page, answer: string): Promise<void> {
  const input = page.getByPlaceholder("Type a country name...");
  await input.fill(answer);
  await input.press("Enter");
}

/** From the reveal to the next question (or the results after the last). */
export async function advance(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Next question|See results/ }).click();
}

/** Name mode, whole round: clicks each question's own country. */
export async function playPerfectNameRound(page: Page, questions: Q[]): Promise<void> {
  for (const q of questions) {
    await page.getByText(q.name, { exact: true }).first().waitFor();
    await clickCountry(page, q.code);
    await advance(page);
  }
}
