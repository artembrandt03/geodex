import { expect, test } from "./support/test";
import { expireTokens } from "./support/db";
import { BASE_URL } from "./support/env";
import { CONFIRM_SUBJECT, tokenIn, waitForMails } from "./support/mail";
import {
  PASSWORD,
  createConfirmedUser,
  credentialsAttempt,
  loginViaForm,
  newUser,
  registerViaApi,
  signUpViaForm,
} from "./support/users";

test.describe("signup edge cases, login, lockout and sign out", () => {
  test("signing up again before confirming replaces the password, and only the new one works", async ({
    request,
  }) => {
    const user = newUser();
    const first = await registerViaApi(request, { ...user, password: "FirstPassword-1" });
    expect(first.status()).toBe(201);
    const second = await registerViaApi(request, { ...user, password: "SecondPassword-2" });
    expect(second.status()).toBe(201);

    // Two emails went out; confirm with the newest.
    const mails = await waitForMails(user.email, CONFIRM_SUBJECT, { count: 2 });
    const verified = await request.post("/api/account/verify-email", {
      data: { token: tokenIn(mails[mails.length - 1]) },
    });
    expect(verified.status()).toBe(200);

    const oldPassword = await credentialsAttempt(request, { email: user.email, password: "FirstPassword-1" });
    expect(oldPassword.signedIn).toBe(false);
    const newPassword = await credentialsAttempt(request, { email: user.email, password: "SecondPassword-2" });
    expect(newPassword.signedIn).toBe(true);
  });

  test("a confirmation link works once; garbage and expired links show a clear failure", async ({
    page,
    request,
  }) => {
    const user = newUser();
    expect((await registerViaApi(request, user)).ok()).toBe(true);
    const [mail] = await waitForMails(user.email, CONFIRM_SUBJECT);
    const token = tokenIn(mail);

    // First use confirms...
    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
    // ...the same link again does not.
    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByRole("heading", { name: "Link not working" })).toBeVisible();

    // No token at all, and a made-up one.
    await page.goto("/verify-email");
    await expect(page.getByRole("heading", { name: "Link not working" })).toBeVisible();
    await page.goto("/verify-email?token=this-is-not-a-real-token-at-all");
    await expect(page.getByRole("heading", { name: "Link not working" })).toBeVisible();

    // An expired one: a fresh signup whose emailed link is aged past its day.
    const late = newUser();
    expect((await registerViaApi(request, late)).ok()).toBe(true);
    const [lateMail] = await waitForMails(late.email, CONFIRM_SUBJECT);
    await expireTokens(late.email);
    await page.goto(`/verify-email?token=${tokenIn(lateMail)}`);
    await expect(page.getByRole("heading", { name: "Link not working" })).toBeVisible();
    await expect(page.getByText(/invalid or has expired/)).toBeVisible();
  });

  test("the signup form guards against typos and a missing consent box", async ({ page, request }) => {
    const user = newUser();

    // Passwords that don't match are caught before anything is sent.
    await signUpViaForm(page, user, { confirmPassword: "something-else-entirely" });
    await expect(page.getByText("Passwords don't match")).toBeVisible();

    // Without ticking the consent box the browser itself blocks the submit.
    await signUpViaForm(page, user, { acceptTerms: false });
    await expect(page.getByRole("checkbox")).toBeFocused();
    await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);

    // The API enforces both on its own, so the form can't be bypassed.
    const noConsent = await request.post("/api/register", {
      data: { displayName: "E2E Player", email: user.email, password: PASSWORD },
    });
    expect(noConsent.status()).toBe(400);
    const shortPassword = await request.post("/api/register", {
      data: { displayName: "E2E Player", email: user.email, password: "short", acceptTerms: true },
    });
    expect(shortPassword.status()).toBe(400);
    expect((await shortPassword.json()).error).toMatch(/at least 8/);
  });

  test("logging in works, shows your name, and Sign out ends the session", async ({ page, request }) => {
    const user = await createConfirmedUser(request, { displayName: "Login Tester" });

    await loginViaForm(page, user);
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByRole("link", { name: /Login Tester, view your profile/ })).toBeVisible();

    // Signing out returns to the title screen (which has no nav bar)...
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // ...and the rest of the site now sees a visitor, not a player.
    await page.goto("/setup");
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: /view your profile/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Play as guest" })).toBeVisible();
  });

  test("five wrong passwords lock the account for a while, even against the right password", async ({
    page,
    request,
  }) => {
    const user = await createConfirmedUser(request);

    for (let i = 0; i < 5; i++) {
      const attempt = await credentialsAttempt(request, { email: user.email, password: `wrong-password-${i}` });
      expect(attempt.signedIn).toBe(false);
      expect(attempt.code).toBe("credentials");
    }

    // The sixth is refused outright, with how long to wait.
    const locked = await credentialsAttempt(request, user);
    expect(locked.signedIn).toBe(false);
    expect(locked.code).toMatch(/^rate_limited_\d+$/);

    await loginViaForm(page, user);
    await expect(page.getByText(/Too many failed attempts\. Please try again in \d+ minutes?\./)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
