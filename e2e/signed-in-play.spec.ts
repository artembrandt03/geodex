import { expect, test } from "./support/test";
import { clearBoard, query, resultsFor, userByEmail } from "./support/db";
import {
  BOARD_LENGTH_BY_PROJECT,
  FIVE,
  playTimedRound,
  playUrl,
  questionsFor,
  stubQuestions,
} from "./support/game";
import { createConfirmedUser, signInContext } from "./support/users";

test.describe("signed-in play, saving and the leaderboard", () => {
  test("a finished round is saved to the player's profile, and shows in their stats and history", async ({
    page,
    context,
    request,
  }) => {
    const user = await createConfirmedUser(request, { displayName: "Saver Test" });
    expect(await signInContext(context, user)).toBe(true);

    await stubQuestions(page, FIVE);
    await page.goto(playUrl("NAME", "EASY", 5));
    await playTimedRound(page, FIVE);

    await expect(page.getByRole("heading", { name: "Round complete" })).toBeVisible();
    await expect(page.getByText("Round saved to your profile")).toBeVisible();
    // A signed-in player isn't nagged to sign up.
    await expect(page.getByText("Playing as a guest")).toHaveCount(0);

    const row = await userByEmail(user.email);
    const saved = await resultsFor(row!.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ mode: "NAME", difficulty: "EASY", roundLength: 5 });
    expect(saved[0].score).toBeGreaterThan(0);

    // The profile page now reflects it.
    await page.goto("/profile");
    await expect(page.getByText("Rounds played").locator("xpath=..")).toContainText("1");
    await expect(page.getByRole("heading", { name: /Match history/i })).toBeVisible();
    await expect(page.getByText("Guess by name").first()).toBeVisible();
  });

  test("taking first place shows the #1 banner, then the leaderboard lists the player with a profile link", async ({
    page,
    context,
    request,
  }, testInfo) => {
    // Two or three times the usual time limit: a long round on a slow WebKit.
    test.slow();
    // A board no other test plays on, emptied first so that a retry of this test (whose earlier
    // attempt saved a round here) can still be the first to score on it.
    const length = BOARD_LENGTH_BY_PROJECT[testInfo.project.name];
    await clearBoard("NAME", "HARD", length);
    const questions = questionsFor(length);
    const user = await createConfirmedUser(request, { displayName: "Champion Test" });
    expect(await signInContext(context, user)).toBe(true);

    await stubQuestions(page, questions);
    await page.goto(playUrl("NAME", "HARD", length));
    await playTimedRound(page, questions);

    await expect(page.getByRole("heading", { name: "Round complete" })).toBeVisible();
    await expect(page.getByText("You're #1!")).toBeVisible();

    // From the results straight to the board that was just played.
    await page.getByRole("link", { name: "Leaderboard", exact: true }).last().click();
    await expect(page).toHaveURL(new RegExp(`difficulty=HARD&roundLength=${length}`));
    const entry = page.getByRole("row").filter({ hasText: "Champion Test" });
    await expect(entry).toHaveCount(1);
    await expect(entry.getByRole("img", { name: /gold trophy/i })).toBeVisible();

    // The player's name opens their public profile.
    await entry.getByRole("link", { name: "Champion Test" }).click();
    await expect(page).toHaveURL(/\/players\//);
    await expect(page.getByText("Champion Test").first()).toBeVisible();
  });

  test("a player appears once on a board, with their best score, not their latest", async ({
    page,
    context,
    request,
  }, testInfo) => {
    // Two long rounds back to back: allow two or three times the usual time limit.
    test.slow();
    const length = BOARD_LENGTH_BY_PROJECT[testInfo.project.name];
    const questions = questionsFor(length);
    // A name no earlier attempt of this test can share (they all play on the same board).
    const displayName = `Best${Math.random().toString(36).slice(2, 8)}`;
    const user = await createConfirmedUser(request, { displayName });
    expect(await signInContext(context, user)).toBe(true);

    await stubQuestions(page, questions);

    // A perfect round first, then a poor one on the same board (MEDIUM, per-project length).
    for (const wrongAt of [[], questions.map((_, i) => i).filter((i) => i % 2 === 0)]) {
      await page.goto(playUrl("NAME", "MEDIUM", length));
      await playTimedRound(page, questions, { wrongAt });
      await expect(page.getByRole("heading", { name: "Round complete" })).toBeVisible();
      await expect(page.getByText("Round saved to your profile")).toBeVisible();
    }

    const row = await userByEmail(user.email);
    const scores = (await resultsFor(row!.id)).map((r) => r.score);
    expect(scores).toHaveLength(2);
    expect(scores[0]).toBeGreaterThan(scores[1]);

    await page.goto(`/leaderboard?mode=NAME&difficulty=MEDIUM&roundLength=${length}`);
    const entries = page.getByRole("row").filter({ hasText: displayName });
    await expect(entries).toHaveCount(1);
    await expect(entries).toContainText(String(scores[0]));
  });

  test("an ended round (left the tab) is never saved, even for a signed-in player", async ({
    page,
    context,
    request,
  }) => {
    const user = await createConfirmedUser(request);
    expect(await signInContext(context, user)).toBe(true);

    await stubQuestions(page, FIVE);
    await page.goto(playUrl("NAME", "EASY", 5));
    await page.getByText(FIVE[0].name, { exact: true }).first().waitFor();

    // Answer two, then "switch tabs" while the third is open.
    await playTimedRound(page, FIVE.slice(0, 2));
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await expect(page.getByRole("alertdialog")).toContainText("Round ended");
    await expect(page.getByRole("alertdialog")).toContainText("answered 2 of 5");
    await page.waitForTimeout(500);

    const row = await userByEmail(user.email);
    expect(await resultsFor(row!.id)).toHaveLength(0);
    const count = await query<{ n: string }>('SELECT count(*)::text AS n FROM "GameResult" WHERE "userId" = $1', [row!.id]);
    expect(count[0].n).toBe("0");
  });
});
