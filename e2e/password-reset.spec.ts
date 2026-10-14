import { expect, test } from "./support/test";
import { expireTokens } from "./support/db";
import {
  CONFIRM_SUBJECT,
  RESET_SUBJECT,
  linkIn,
  mailsTo,
  tokenIn,
  waitForMails,
} from "./support/mail";
import {
  createConfirmedUser,
  credentialsAttempt,
  loginViaForm,
  newUser,
  registerViaApi,
  settled,
  uniqueEmail,
} from "./support/users";

async function requestReset(page: import("@playwright/test").Page, email: string) {
  await page.goto("/forgot-password");
  await settled(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Email").press("Enter");
}

test.describe("forgot password and reset", () => {
  test("the page says the same thing for any address, but only a real account gets an email", async ({
    page,
    request,
  }) => {
    const real = await createConfirmedUser(request);
    const stranger = uniqueEmail("nobody");

    await requestReset(page, stranger);
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(`If ${stranger} has a Geodex account`)).toBeVisible();
    expect(await mailsTo(stranger), "no email to an address without an account").toEqual([]);

    await requestReset(page, real.email);
    await expect(page.getByText(`If ${real.email} has a Geodex account`)).toBeVisible();
    const [mail] = await waitForMails(real.email, RESET_SUBJECT);
    expect(mail.subject).toBe("Reset your Geodex password");
    expect(linkIn(mail)).toContain("/reset-password?token=");
  });

  test("a full reset: the new password works, the old one stops, and the form guards typos", async ({
    page,
    request,
  }) => {
    const user = await createConfirmedUser(request);
    const newPassword = "Brand-New-Passw0rd";

    expect((await request.post("/api/account/forgot-password", { data: { email: user.email } })).ok()).toBe(true);
    const [mail] = await waitForMails(user.email, RESET_SUBJECT);
    const link = new URL(linkIn(mail));

    await page.goto(link.pathname + link.search);
    await settled(page);
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password", { exact: true }).fill("a-different-one-1");
    await page.getByLabel("Confirm new password", { exact: true }).press("Enter");
    await expect(page.getByText("Passwords don't match")).toBeVisible();

    await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/login\?reset=1/);
    await expect(page.getByText("Your password was changed")).toBeVisible();

    expect((await credentialsAttempt(request, { email: user.email, password: user.password })).signedIn).toBe(false);
    await loginViaForm(page, { email: user.email, password: newPassword });
    await expect(page).toHaveURL(/\/setup$/);
  });

  test("a reset link works once, and invalid, missing or expired ones say so and offer a new one", async ({
    page,
    request,
  }) => {
    const user = await createConfirmedUser(request);
    await request.post("/api/account/forgot-password", { data: { email: user.email } });
    const [mail] = await waitForMails(user.email, RESET_SUBJECT);
    const token = tokenIn(mail);

    const first = await request.post("/api/account/reset-password", {
      data: { token, password: "Once-Only-Passw0rd" },
    });
    expect(first.status()).toBe(200);
    const again = await request.post("/api/account/reset-password", {
      data: { token, password: "Twice-Passw0rd-1" },
    });
    expect(again.status()).toBe(400);

    // A short password is refused before the link is used up.
    await request.post("/api/account/forgot-password", { data: { email: user.email } });
    const mails = await waitForMails(user.email, RESET_SUBJECT, { count: 2 });
    const second = tokenIn(mails[mails.length - 1]);
    const short = await request.post("/api/account/reset-password", { data: { token: second, password: "short" } });
    expect(short.status()).toBe(400);

    // The page: no token at all, then an expired one.
    await page.goto("/reset-password");
    await expect(page.getByText("This reset link isn't valid.")).toBeVisible();
    await expireTokens(user.email);
    await page.goto(`/reset-password?token=${second}`);
    await settled(page);
    await page.getByLabel("New password", { exact: true }).fill("Late-Passw0rd-1");
    await page.getByLabel("Confirm new password", { exact: true }).fill("Late-Passw0rd-1");
    await page.getByLabel("Confirm new password", { exact: true }).press("Enter");
    await expect(page.getByText(/invalid or has expired/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Request a new link" })).toBeVisible();
  });

  test("resetting the password also confirms an account that never confirmed its email", async ({
    request,
  }) => {
    const user = newUser();
    expect((await registerViaApi(request, user)).ok()).toBe(true);
    await waitForMails(user.email, CONFIRM_SUBJECT);

    // Unconfirmed: can't log in.
    expect((await credentialsAttempt(request, user)).code).toBe("email_not_verified");

    // Following the reset link proves the inbox, so it confirms the address too.
    await request.post("/api/account/forgot-password", { data: { email: user.email } });
    const [mail] = await waitForMails(user.email, RESET_SUBJECT);
    const newPassword = "Reset-And-Confirmed-1";
    const reset = await request.post("/api/account/reset-password", {
      data: { token: tokenIn(mail), password: newPassword },
    });
    expect(reset.status()).toBe(200);

    const attempt = await credentialsAttempt(request, { email: user.email, password: newPassword });
    expect(attempt.signedIn).toBe(true);
  });

  test("a locked-out player who resets their password can log in straight away", async ({ request }) => {
    const user = await createConfirmedUser(request);
    for (let i = 0; i < 5; i++) {
      await credentialsAttempt(request, { email: user.email, password: `wrong-${i}-password` });
    }
    expect((await credentialsAttempt(request, user)).code).toMatch(/^rate_limited_/);

    await request.post("/api/account/forgot-password", { data: { email: user.email } });
    const [mail] = await waitForMails(user.email, RESET_SUBJECT);
    const newPassword = "After-Lockout-Passw0rd";
    const reset = await request.post("/api/account/reset-password", {
      data: { token: tokenIn(mail), password: newPassword },
    });
    expect(reset.status()).toBe(200);

    const attempt = await credentialsAttempt(request, { email: user.email, password: newPassword });
    expect(attempt.signedIn).toBe(true);
  });
});
