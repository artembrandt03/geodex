import { expect, test } from "./support/test";
import { click } from "./support/click";
import { CONFIRM_SUBJECT, linkIn, mailsTo, tokenIn, waitForMails } from "./support/mail";
import {
  createConfirmedUser,
  loginViaForm,
  newUser,
  registerViaApi,
  signUpViaForm,
} from "./support/users";

test.describe("signup and email confirmation", () => {
  test("sign up, confirm by email, and one click logs you straight in", async ({ page }) => {
    const user = newUser();
    await signUpViaForm(page, user);

    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(user.email)).toBeVisible();

    const [mail] = await waitForMails(user.email, CONFIRM_SUBJECT);
    expect(mail.subject).toBe("Confirm your Geodex account");
    expect(mail.text).toContain(user.displayName);

    const link = new URL(linkIn(mail));
    await page.goto(link.pathname + link.search);
    await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
    await page.getByRole("button", { name: "Log in to my account" }).click();

    // Signed in, on the setup screen, with their name in the nav.
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByRole("link", { name: /view your profile/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  });

  test("an account cannot log in until its email is confirmed, and says so", async ({ page, request }) => {
    const user = newUser();
    expect((await registerViaApi(request, user)).ok()).toBe(true);

    // A wrong password just fails; it must not reveal that the account exists.
    await loginViaForm(page, { email: user.email, password: "definitely-wrong-1" });
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page.getByText("Please confirm your email first")).toHaveCount(0);

    // The right password is told what to do instead.
    await loginViaForm(page, user);
    await expect(page.getByText("Please confirm your email first")).toBeVisible();
    await expect(page.getByRole("button", { name: "Resend the confirmation email" })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("resending sends a fresh link and the older one stops working", async ({ page, request }) => {
    const user = newUser();
    expect((await registerViaApi(request, user)).ok()).toBe(true);
    const [first] = await waitForMails(user.email, CONFIRM_SUBJECT);

    await loginViaForm(page, user);
    await click(page.getByRole("button", { name: "Resend the confirmation email" }));
    await expect(page.getByText(/Sent\./)).toBeVisible();

    const mails = await waitForMails(user.email, CONFIRM_SUBJECT, { count: 2 });
    const latest = mails[mails.length - 1];
    expect(tokenIn(latest)).not.toBe(tokenIn(first));

    const old = await request.post("/api/account/verify-email", { data: { token: tokenIn(first) } });
    expect(old.status()).toBe(400);
    const fresh = await request.post("/api/account/verify-email", { data: { token: tokenIn(latest) } });
    expect(fresh.status()).toBe(200);
  });

  test("signing up with an address that already has an account sends you to log in", async ({
    page,
    request,
  }) => {
    const existing = await createConfirmedUser(request);

    await signUpViaForm(page, { ...existing, displayName: "Someone Else" });

    await expect(page).toHaveURL(/\/login\?exists=1/);
    await expect(page.getByText("You already have an account with that email")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(existing.email);
    // No second account, and no new email was sent.
    expect((await mailsTo(existing.email)).length).toBe(1);
  });

  test("made-up and throwaway email domains are refused with a clear message", async ({ page }) => {
    await signUpViaForm(page, newUser({ email: "nonexistent@poop.com" }));
    await expect(page.getByText("doesn't seem to receive mail")).toBeVisible();

    await signUpViaForm(page, newUser({ email: `e2e-${Date.now()}@mailinator.com` }));
    await expect(page.getByText("Temporary email addresses can't be used")).toBeVisible();

    // Neither attempt created anything to confirm.
    await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
  });
});
