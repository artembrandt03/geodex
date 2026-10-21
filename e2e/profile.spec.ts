import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { click } from "./support/click";
import { query, resultsFor, userByEmail } from "./support/db";
import { FIVE, playTimedRound, playUrl, stubQuestions } from "./support/game";
import {
  createConfirmedUser,
  credentialsAttempt,
  settled,
  signInContext,
  type TestUser,
} from "./support/users";

/** A confirmed, signed-in player standing on their profile page. */
async function signedInOnProfile(
  page: Page,
  context: BrowserContext,
  request: import("@playwright/test").APIRequestContext,
  overrides: Partial<TestUser> = {},
) {
  const user = await createConfirmedUser(request, overrides);
  expect(await signInContext(context, user)).toBe(true);
  await page.goto("/profile");
  await settled(page);
  await expect(page.getByText("Member since")).toBeVisible();
  return user;
}

/**
 * Holds a "press and hold" button down until the action it guards is actually requested
 * (then lets go), rather than for a fixed time, so a slow machine can't make a hold fall short.
 * Chromium holds with the mouse, like a person. WebKit holds with the keyboard (Space, which
 * the button supports too): Playwright's WebKit build on Linux drops pointer events of a long
 * mouse press now and then, while it works every time on Chromium and WebKit-on-Windows.
 */
async function holdToConfirm(
  page: Page,
  name: string,
  browserName: string,
  request: { method: string; path: string },
) {
  const button = page.getByRole("button", { name });
  await expect(button).toBeEnabled();
  const sent = page.waitForRequest(
    (r) => r.method() === request.method && new URL(r.url()).pathname === request.path,
    { timeout: 20_000 },
  );
  if (browserName === "webkit") {
    await button.focus();
    await page.keyboard.down("Space");
    await sent;
    await page.keyboard.up("Space");
  } else {
    await button.hover();
    await page.mouse.down();
    await sent;
    await page.mouse.up();
  }
}

const RESET = { method: "POST", path: "/api/profile/reset" };
const DELETE = { method: "DELETE", path: "/api/profile" };

test.describe("profile management", () => {
  test("changing the display name updates the nav bar at once, and offensive names are refused", async ({
    page,
    context,
    request,
  }) => {
    await signedInOnProfile(page, context, request, { displayName: "Before Name" });

    await click(page.getByRole("button", { name: "Change" }).first());
    const dialog = page.getByRole("dialog");

    // The profanity filter applies to renames, not just signup.
    await dialog.getByLabel("Display name").fill("sh1thead");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("link", { name: /Before Name, view your profile/ })).toBeVisible();

    await dialog.getByLabel("Display name").fill("After Name");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);

    // The nav and the card both show the new name without a reload.
    await expect(page.getByRole("link", { name: /After Name, view your profile/ })).toBeVisible();
    await expect(page.getByText("After Name").first()).toBeVisible();
  });

  test("changing the password needs the current one, then only the new password works", async ({
    page,
    context,
    request,
  }) => {
    const user = await signedInOnProfile(page, context, request);
    const newPassword = "Changed-Passw0rd-9";

    await click(page.getByRole("button", { name: "Change" }).nth(1));
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Current password", { exact: true }).fill("not-my-password-1");
    await dialog.getByLabel("New password", { exact: true }).fill(newPassword);
    await dialog.getByLabel("Repeat new password", { exact: true }).fill(newPassword);
    await dialog.getByRole("button", { name: "Change password" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();

    await dialog.getByLabel("Current password", { exact: true }).fill(user.password);
    await dialog.getByRole("button", { name: "Change password" }).click();
    await expect(dialog.getByText("Password changed")).toBeVisible();

    // `request` has no cookies from the browser, so these are clean logins.
    expect((await credentialsAttempt(request, user)).signedIn).toBe(false);
    expect((await credentialsAttempt(request, { email: user.email, password: newPassword })).signedIn).toBe(true);
  });

  test("a private profile is hidden from everyone but its owner, and sharing it again restores it", async ({
    page,
    context,
    request,
  }) => {
    const user = await signedInOnProfile(page, context, request, { displayName: "Shy Player" });
    const id = (await userByEmail(user.email))!.id;
    const toggle = page.getByRole("switch", { name: "Public profile" });
    await expect(toggle).toBeChecked();

    // Public by default: anyone can read the stats, and the email is never part of it.
    const publicView = await request.get(`/api/players/${id}`);
    expect(publicView.status()).toBe(200);
    expect(JSON.stringify(await publicView.json())).not.toContain(user.email);

    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect.poll(async () => (await request.get(`/api/players/${id}`)).status()).toBe(403);
    // ...but the owner still sees it, with a note that it's private.
    expect((await context.request.get(`/api/players/${id}`)).status()).toBe(200);

    // A visitor following a link gets the friendly message, not an error page.
    const visitor = await page.context().browser()!.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(`${new URL(page.url()).origin}/players/${id}`);
    await expect(visitorPage.getByText("This player has chosen to keep their profile private.")).toBeVisible();
    await visitor.close();

    await toggle.click();
    await expect(toggle).toBeChecked();
    await expect.poll(async () => (await request.get(`/api/players/${id}`)).status()).toBe(200);
  });

  test("resetting statistics erases every round after the password and a two-second hold", async ({
    page,
    context,
    request,
    browserName,
  }) => {
    const user = await createConfirmedUser(request);
    expect(await signInContext(context, user)).toBe(true);

    // One saved round to erase.
    await stubQuestions(page, FIVE);
    await page.goto(playUrl("NAME", "EASY", 5));
    await playTimedRound(page, FIVE);
    await expect(page.getByText("Round saved to your profile")).toBeVisible();
    const id = (await userByEmail(user.email))!.id;
    expect(await resultsFor(id)).toHaveLength(1);

    await page.goto("/profile");
    await settled(page);
    await expect(page.getByText("Rounds played").locator("xpath=..")).toContainText("1");
    await click(page.getByRole("button", { name: "Reset statistics" }));

    const dialog = page.getByRole("dialog");
    // Nothing happens until the password is typed: the hold button stays locked.
    await expect(dialog.getByRole("button", { name: "Hold to reset" })).toBeDisabled();
    await dialog.getByLabel("Enter your password to confirm", { exact: true }).fill(user.password);

    // A quick tap is not enough...
    await dialog.getByRole("button", { name: "Hold to reset" }).click();
    expect(await resultsFor(id)).toHaveLength(1);

    // ...a full hold is.
    await holdToConfirm(page, "Hold to reset", browserName, RESET);
    await expect(dialog.getByText("Statistics reset")).toBeVisible();
    expect(await resultsFor(id)).toHaveLength(0);
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Nothing here yet.")).toBeVisible();

    // The account itself is untouched.
    expect(await userByEmail(user.email)).not.toBeNull();
  });

  test("deleting the account needs the password and a hold, signs out, and removes the account for good", async ({
    page,
    context,
    request,
    browserName,
  }) => {
    const user = await signedInOnProfile(page, context, request, { displayName: "Soon Gone" });
    const id = (await userByEmail(user.email))!.id;

    await click(page.getByRole("button", { name: "Delete account" }));
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Enter your password to confirm", { exact: true }).fill("not-the-password-1");
    await holdToConfirm(page, "Hold to delete", browserName, DELETE);
    // The wrong password is refused by the server even after a full hold.
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(await userByEmail(user.email)).not.toBeNull();

    await dialog.getByLabel("Enter your password to confirm", { exact: true }).fill(user.password);
    await holdToConfirm(page, "Hold to delete", browserName, DELETE);
    await expect(dialog.getByText("Your account has been deleted")).toBeVisible();

    // Signed out and sent back to the title screen (a couple of sequential requests, slow on a loaded WebKit).
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/`, { timeout: 40_000 });
    expect(await userByEmail(user.email)).toBeNull();
    const leftovers = await query<{ n: string }>(
      'SELECT count(*)::text AS n FROM "EmailToken" WHERE "userId" = $1',
      [id],
    );
    expect(leftovers[0].n).toBe("0");

    // The credentials no longer work.
    expect((await credentialsAttempt(request, user)).signedIn).toBe(false);
  });

  test("signed-out visitors get a log-in prompt, and every account endpoint refuses them", async ({
    page,
    request,
  }) => {
    await page.goto("/profile");
    await expect(page.getByText("Log in to see your profile, stats and match history.")).toBeVisible();
    await expect(page.getByText("Member since")).toHaveCount(0);

    const attempts = [
      request.get("/api/profile"),
      request.get("/api/profile/history"),
      request.patch("/api/profile", { data: { displayName: "Hacked Name" } }),
      request.post("/api/profile/password", { data: { currentPassword: "x", newPassword: "y".repeat(10) } }),
      request.post("/api/profile/reset", { data: { password: "x" } }),
      request.delete("/api/profile", { data: { password: "x" } }),
    ];
    for (const response of await Promise.all(attempts)) {
      expect(response.status(), response.url()).toBe(401);
    }
  });
});
