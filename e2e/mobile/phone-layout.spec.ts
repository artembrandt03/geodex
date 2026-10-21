import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { click } from "../support/click";
import { seedResult, userByEmail } from "../support/db";
import {
  BOARD_LENGTH_BY_PROJECT,
  FIVE,
  advance,
  clickCountry,
  playPerfectNameRound,
  playUrl,
  stubQuestions,
} from "../support/game";
import { BASE_URL } from "../support/env";
import { createConfirmedUser, signInContext } from "../support/users";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element has no box (not visible?)");
  return b;
}

/** True when two rectangles share any area. A hair of tolerance so touching edges don't count. */
function overlaps(a: Box, b: Box, tolerance = 1): boolean {
  return (
    a.x + a.width - tolerance > b.x &&
    b.x + b.width - tolerance > a.x &&
    a.y + a.height - tolerance > b.y &&
    b.y + b.height - tolerance > a.y
  );
}

async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe("phone layout", () => {
  test("the header is just a back arrow, the globe and a menu, and the menu reaches everything", async ({
    page,
  }) => {
    await page.goto("/about");

    // The desktop links aren't in the header at all.
    await expect(page.getByRole("link", { name: "About", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to title screen" })).toBeVisible();
    const menuButton = page.getByRole("button", { name: "Open menu" });
    await expect(menuButton).toBeVisible();
    expect((await box(menuButton)).width, "tap target").toBeGreaterThanOrEqual(32);

    // News & updates comes first on a phone.
    const news = await box(page.getByRole("heading", { name: "News & updates" }));
    const aboutMe = await box(page.getByRole("heading", { name: "About me" }));
    expect(news.y).toBeLessThan(aboutMe.y);

    await menuButton.click();
    await expect(page.getByRole("button", { name: "Close menu" }).first()).toBeVisible();
    for (const name of ["About", "Log in", "Sign up"]) {
      await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Leaderboard" })).toBeVisible();

    // Log in and Sign up are styled alike.
    const background = (name: string) =>
      page.getByRole("link", { name, exact: true }).evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(await background("Sign up")).toBe(await background("Log in"));

    // Escape closes it; reopening and following a link goes there and closes it.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "Log in", exact: true })).toHaveCount(0);
    await menuButton.click();
    await page.getByRole("link", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/login"));
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test("signed in, the menu shows the player and Sign out works", async ({ page, context, request }) => {
    const user = await createConfirmedUser(request, { displayName: "Menu Tester" });
    expect(await signInContext(context, user)).toBe(true);
    await page.goto("/setup");

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("link", { name: "Menu Tester" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in", exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: "Menu Tester" }).click();
    await expect(page).toHaveURL(new RegExp("/profile"));

    await page.getByRole("button", { name: "Open menu" }).click();
    await click(page.getByRole("button", { name: "Sign out" }));
    // Wait for the sign-out to finish (it ends on the title screen) before navigating away,
    // or the request is aborted and the session survives.
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await page.goto("/setup");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("link", { name: "Log in", exact: true })).toBeVisible();
  });

  test("during a round nothing overlaps: stats, streak, prompt, answer banner and the map controls", async ({
    page,
  }) => {
    await stubQuestions(page, FIVE);
    await page.goto(playUrl("NAME"));
    await expect(page.getByText("Question 1 / 5")).toBeVisible();

    // Build a streak so the badge is on screen too.
    await clickCountry(page, FIVE[0].code);
    await advance(page);
    await clickCountry(page, FIVE[1].code);
    await advance(page);
    await expect(page.getByText("Question 3 / 5")).toBeVisible();

    const streakBadge = page.locator('[aria-label^="Streak of"]:visible');
    await expect(streakBadge).toHaveCount(1);

    const boxes = {
      stats: await box(page.getByText("Question 3 / 5").locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")),
      streak: await box(streakBadge),
      score: await box(page.locator('span:text-is("Score")').locator("xpath=..")),
      prompt: await box(page.getByText("Find this country").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]")),
    };
    expect(overlaps(boxes.prompt, boxes.stats), "prompt vs question card").toBe(false);
    expect(overlaps(boxes.prompt, boxes.streak), "prompt vs streak badge").toBe(false);
    expect(overlaps(boxes.prompt, boxes.score), "prompt vs score").toBe(false);
    expect(overlaps(boxes.stats, boxes.streak), "question card vs streak badge").toBe(false);
    expect(overlaps(boxes.streak, boxes.score), "streak badge vs score").toBe(false);

    // The answer banner and Next button don't sit on the map's zoom buttons.
    await clickCountry(page, FIVE[2].code);
    const next = page.getByRole("button", { name: /Next question/ });
    await expect(next).toBeVisible();
    const banner = await box(page.getByText(/Correct!/).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]"));
    const controls = [
      await box(page.getByRole("button", { name: "Zoom in", exact: true })),
      await box(page.getByRole("button", { name: "Zoom out", exact: true })),
      await box(page.getByRole("button", { name: "Reset view" })),
    ];
    for (const control of controls) {
      expect(overlaps(banner, control), "answer banner vs a zoom button").toBe(false);
      expect(overlaps(await box(next), control), "Next button vs a zoom button").toBe(false);
    }

    // Touch screens get no keyboard hint on the Next button.
    await expect(next.locator("kbd")).toBeHidden();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("the results card scrolls as one piece, with every button reachable and nothing on top of anything", async ({
    page,
  }) => {
    await stubQuestions(page, FIVE);
    await page.goto(playUrl("NAME"));
    await playPerfectNameRound(page, FIVE);

    const heading = page.getByRole("heading", { name: "Round complete" });
    await expect(heading).toBeVisible();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

    const card = heading.locator("xpath=ancestor::div[contains(@class,'overflow-y-auto')][1]");
    const cardBox = await box(card);
    const viewport = page.viewportSize()!;
    expect(cardBox.height, "card fits on screen").toBeLessThanOrEqual(viewport.height);
    expect(cardBox.x + cardBox.width, "card within the width").toBeLessThanOrEqual(viewport.width);

    // The points list ends before the buttons begin (they used to overlap).
    const playAgain = card.getByRole("button", { name: "Play again", exact: true });
    const leaderboard = card.getByRole("link", { name: "Leaderboard", exact: true });
    const home = card.getByRole("link", { name: "Home", exact: true });
    await home.scrollIntoViewIfNeeded();
    const list = await box(card.getByRole("list").last());
    expect(list.y + list.height, "list ends above the buttons").toBeLessThanOrEqual((await box(playAgain)).y + 1);
    expect(overlaps(await box(leaderboard), await box(home)), "the two link buttons").toBe(false);
    for (const control of [playAgain, leaderboard, home]) await expect(control).toBeVisible();
  });

  test("the leaderboard and the setup screen fit the screen, and the selected tick stays off the numbers", async ({
    page,
    request,
  }, testInfo) => {
    // A board of its own, with a long name to stress the table.
    const length = BOARD_LENGTH_BY_PROJECT[testInfo.project.name];
    // A long name (the limit is 30 characters), unique so a retry doesn't meet its own earlier row.
    const displayName = `Averyverylongname${Math.random().toString(36).slice(2, 8)}`;
    const user = await createConfirmedUser(request, { displayName });
    await seedResult((await userByEmail(user.email))!.id, { difficulty: "HARD", roundLength: length, score: 987 });

    await page.goto(`/leaderboard?mode=NAME&difficulty=HARD&roundLength=${length}`);
    const row = page.getByRole("row").filter({ hasText: displayName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("987");
    const viewport = page.viewportSize()!;
    for (const header of ["#", "Player", "Score", "Correct"]) {
      const cell = await box(page.getByRole("columnheader", { name: header, exact: true }));
      expect(cell.x + cell.width, `"${header}" column is on screen`).toBeLessThanOrEqual(viewport.width);
    }
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    // The three filters are reachable and not squashed.
    for (const select of await page.getByRole("combobox").all()) {
      expect((await box(select)).width).toBeGreaterThan(100);
    }

    // Setup: round lengths with their tick on the corner, not over the number.
    await page.goto("/setup");
    // The selected card's name includes its tick, so match the number at the end.
    const ten = page.getByRole("button", { name: new RegExp("10$") });
    await ten.click();
    const tick = await box(ten.getByText("✓"));
    // The number is a bare text node in the button, so its rectangle comes from a DOM range.
    const number = await ten.evaluate((button) => {
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent?.trim() !== "10") continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const { x, y, width, height } = range.getBoundingClientRect();
        return { x, y, width, height };
      }
      return null;
    });
    expect(number, "found the number's text").not.toBeNull();
    expect(overlaps(tick, number!, 0), "tick vs the number").toBe(false);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
  });
});
