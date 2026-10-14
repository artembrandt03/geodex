import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import {
  AUSTRALIA,
  BRAZIL,
  CUBA,
  EGYPT,
  FIVE,
  JAPAN,
  PORTUGAL,
  SPAIN,
  USA,
  advance,
  clickCountry,
  guessShape,
  playPerfectNameRound,
  playUrl,
  stubQuestions,
} from "./support/game";

/** The running score in the top-right card (not the results card's "Total score"). */
function scoreBox(page: Page) {
  return page.locator('span:text-is("Score") + span');
}

test.describe("guest play", () => {
  test("a full name-mode round ends on the results card, and a guest's round is not saved", async ({
    page,
  }) => {
    const saveCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/rounds/complete")) saveCalls.push(request.url());
    });

    await stubQuestions(page, FIVE);
    await page.goto(playUrl("NAME"));
    await expect(page.getByText("Find this country")).toBeVisible();
    await expect(page.getByText("Question 1 / 5")).toBeVisible();

    await playPerfectNameRound(page, FIVE);

    await expect(page.getByRole("heading", { name: "Round complete" })).toBeVisible();
    await expect(page.getByText("5 / 5")).toBeVisible();
    await expect(page.getByText("Perfect round!")).toBeVisible();
    await expect(page.getByText("Playing as a guest, so this round wasn't saved.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" }).last()).toHaveAttribute("href", "/register");
    expect(saveCalls, "a guest's result must never be sent to the server").toEqual([]);
  });

  test("shape mode accepts aliases, ignores case and spacing, and names the answer when you miss", async ({
    page,
    browserName,
  }) => {
    await stubQuestions(page, [USA, JAPAN, BRAZIL, EGYPT, AUSTRALIA]);
    await page.goto(playUrl("SHAPE"));
    await expect(page.getByText("Which country is highlighted?")).toBeVisible();

    // "USA" is an alias for the United States of America.
    await guessShape(page, "USA");
    await expect(page.getByText("Correct!")).toBeVisible();
    await expect(page.getByText("United States of America").first()).toBeVisible();
    await advance(page);

    await guessShape(page, "  jApAn ");
    await expect(page.getByText("Correct!")).toBeVisible();
    await advance(page);

    await guessShape(page, "BRAZIL");
    await expect(page.getByText("Correct!")).toBeVisible();
    await advance(page);

    // A wrong answer: says what was typed and what the answer was.
    await guessShape(page, "Kenya");
    await expect(page.getByText(/Not quite, that's/)).toContainText("Kenya");
    await expect(page.getByText("The answer was")).toContainText("Egypt");
    await advance(page);

    // The last one is submitted with Enter (Chromium only; see guessShape for WebKit).
    await guessShape(page, "Australia", { submit: browserName === "chromium" ? "enter" : "button" });
    await advance(page);

    await expect(page.getByRole("heading", { name: "Round complete" })).toBeVisible();
    await expect(page.getByText("4 / 5")).toBeVisible();
  });

  test("a wrong guess next to the answer earns the 1-point neighbor bonus, other wrong guesses earn nothing", async ({
    page,
  }) => {
    await stubQuestions(page, [SPAIN, JAPAN, BRAZIL, EGYPT, AUSTRALIA]);
    await page.goto(playUrl("NAME"));
    await expect(page.getByText("Spain", { exact: true }).first()).toBeVisible();

    // Portugal borders Spain.
    await clickCountry(page, PORTUGAL.code);
    await expect(page.getByText("So close, that's")).toContainText("Portugal");
    await expect(page.getByRole("listitem").filter({ hasText: "Neighbor" })).toContainText("+1");
    await expect(scoreBox(page)).toHaveText("1");
    await advance(page);

    // Cuba is nowhere near Japan: no points, and no point chips at all.
    await clickCountry(page, CUBA.code);
    await expect(page.getByText("Not quite, that's")).toContainText("Cuba");
    await expect(page.getByRole("listitem").filter({ hasText: "Neighbor" })).toHaveCount(0);
    await expect(scoreBox(page)).toHaveText("1");
  });

  test("speed and streak bonuses follow the rules (easy: base 10, speed tiers, streak from the 3rd)", async ({
    page,
  }) => {
    // The clock keeps running normally after install; fastForward jumps it ahead,
    // so "answered after N seconds" is exact without waiting that long.
    await page.clock.install();
    await stubQuestions(page, [CUBA, JAPAN, BRAZIL, EGYPT, AUSTRALIA]);
    await page.goto(playUrl("NAME"));
    await expect(page.getByText("Cuba", { exact: true }).first()).toBeVisible();

    // 3s: base 10 + speed 10 (under 5s doubles it).
    await page.clock.fastForward(3_000);
    await clickCountry(page, CUBA.code);
    await expect(page.getByRole("listitem").filter({ hasText: "Speed" })).toContainText("+10");
    await expect(scoreBox(page)).toHaveText("20");
    await advance(page);

    // 8s: speed +5 (under 10s adds half).
    await page.clock.fastForward(8_000);
    await clickCountry(page, JAPAN.code);
    await expect(page.getByRole("listitem").filter({ hasText: "Speed" })).toContainText("+5");
    await expect(scoreBox(page)).toHaveText("35");
    await advance(page);

    // 12s: speed +3 (under 15s adds a quarter, 2.5 rounds up) and the 3rd in a row starts the streak at +5.
    await page.clock.fastForward(12_000);
    await clickCountry(page, BRAZIL.code);
    await expect(page.getByRole("listitem").filter({ hasText: "Speed" })).toContainText("+3");
    await expect(page.getByRole("listitem").filter({ hasText: "Streak" })).toContainText("+5");
    await expect(scoreBox(page)).toHaveText("53");
    await advance(page);

    // 20s: too slow for any speed bonus; the streak grows to +6.
    await page.clock.fastForward(20_000);
    await clickCountry(page, EGYPT.code);
    await expect(page.getByRole("listitem").filter({ hasText: "Speed" })).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasText: "Streak" })).toContainText("+6");
    await expect(scoreBox(page)).toHaveText("69");
  });

  test("Enter moves on from the answer, and the last question's button says See results", async ({
    page,
  }) => {
    await stubQuestions(page, FIVE);
    await page.goto(playUrl("NAME"));

    for (let i = 0; i < 4; i++) {
      await expect(page.getByText(`Question ${i + 1} / 5`)).toBeVisible();
      await clickCountry(page, FIVE[i].code);
      await expect(page.getByRole("button", { name: /Next question/ })).toBeVisible();
      await page.keyboard.press("Enter");
    }

    await expect(page.getByText("Question 5 / 5")).toBeVisible();
    await clickCountry(page, FIVE[4].code);
    await expect(page.getByRole("button", { name: /See results/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Round complete" })).toBeVisible();
  });
});
