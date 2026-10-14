import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import {
  CUBA,
  FIVE,
  advance,
  clickCountry,
  playUrl,
  stubQuestions,
} from "./support/game";

/** What the browser does when you switch tabs or minimize the window. */
async function hideTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

test.describe("round integrity: leaving the tab, going idle, leaving mid-round", () => {
  test("switching tabs while a question is open ends the round, explains why, and Play again starts fresh", async ({
    page,
  }) => {
    await stubQuestions(page, FIVE);
    await page.goto(playUrl("NAME"));
    await expect(page.getByText("Question 1 / 5")).toBeVisible();
    await clickCountry(page, CUBA.code);
    await advance(page);
    await expect(page.getByText("Question 2 / 5")).toBeVisible();

    await hideTab(page);

    const card = page.getByRole("alertdialog");
    await expect(card).toContainText("Round ended");
    await expect(card).toContainText("You left the game tab");
    await expect(card).toContainText("don't look answers up");
    await expect(card).toContainText("answered 1 of 5");
    await expect(card).toContainText("doesn't count");
    await expect(card.getByRole("link", { name: "Back to setup" })).toHaveAttribute("href", "/setup");

    // The question and the map are gone behind it: nothing left to guess.
    await expect(page.getByText("Find this country")).toHaveCount(0);

    // Play again is a brand-new round: question 1, score 0.
    await card.getByRole("button", { name: "Play again" }).click();
    await expect(page.getByText("Question 1 / 5")).toBeVisible();
    await expect(page.locator('span:text-is("Score") + span')).toHaveText("0");
  });

  test("switching tabs while an answer is being shown does not end the round", async ({ page }) => {
    await stubQuestions(page, FIVE);
    await page.goto(playUrl("NAME"));
    await clickCountry(page, CUBA.code);
    await expect(page.getByRole("button", { name: /Next question/ })).toBeVisible();

    await hideTab(page);
    await page.waitForTimeout(400);

    // Still on the reveal, and the round carries on.
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await advance(page);
    await expect(page.getByText("Question 2 / 5")).toBeVisible();
  });

  test("a question left unanswered for 60 seconds ends the round, with a warning first", async ({ page }) => {
    await page.clock.install();
    await stubQuestions(page, FIVE);
    await page.goto(playUrl("NAME"));
    await expect(page.getByText("Find this country")).toBeVisible();

    // Quiet for the first 45 seconds...
    await page.clock.fastForward(40_000);
    await expect(page.getByText("Answer soon or the round ends")).toHaveCount(0);

    // ...then the last 15 are counted down...
    await page.clock.fastForward(8_000);
    await expect(page.getByText("Answer soon or the round ends")).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    // ...and the minute ends it.
    await page.clock.fastForward(13_000);
    const card = page.getByRole("alertdialog");
    await expect(card).toContainText("Round ended");
    await expect(card).toContainText("went unanswered for 60 seconds");
    await expect(card).toContainText("answered 0 of 5");
  });

  test("going idle ends a shape-mode round even while the player is typing", async ({ page }) => {
    await page.clock.install();
    await stubQuestions(page, FIVE);
    await page.goto(playUrl("SHAPE"));
    await expect(page.getByText("Which country is highlighted?")).toBeVisible();

    // Typed but never submitted: still counts as unanswered.
    await page.locator("#country-names option").first().waitFor({ state: "attached" });
    await page.getByPlaceholder("Type a country name...").fill("Cub");
    await page.clock.fastForward(61_000);

    await expect(page.getByRole("alertdialog")).toContainText("went unanswered for 60 seconds");
  });

  test("leaving mid-round asks first: Continue and Escape keep playing, Enter can't skip ahead behind it, End round leaves", async ({
    page,
  }) => {
    await stubQuestions(page, FIVE);
    await page.goto(playUrl("NAME"));
    await expect(page.getByText("Question 1 / 5")).toBeVisible();
    await clickCountry(page, CUBA.code);
    await expect(page.getByRole("button", { name: /Next question/ })).toBeVisible();

    // Clicking a nav link during the answer screen opens a real, labelled dialog...
    await page.getByRole("link", { name: "About" }).click();
    const dialog = page.getByRole("alertdialog", { name: "End this round?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("your progress won't be saved");

    // ...focused on the safe choice, so Enter means "Continue playing" and does NOT
    // also advance to the next question behind it.
    await expect(dialog.getByRole("button", { name: "Continue playing" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Question 1 / 5")).toBeVisible();
    await expect(page.getByRole("button", { name: /Next question/ })).toBeVisible();
    await expect(page).toHaveURL(new RegExp("/play"));

    // Escape also keeps playing.
    await page.getByRole("link", { name: "About" }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp("/play"));

    // Only "End round" actually leaves.
    await page.getByRole("link", { name: "About" }).click();
    await dialog.getByRole("button", { name: "End round" }).click();
    await expect(page).toHaveURL(new RegExp("/about$"));
  });
});
