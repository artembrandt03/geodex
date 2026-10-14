import { randomBytes } from "node:crypto";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { BASE_URL, PASSWORD } from "./env";
import { CONFIRM_SUBJECT, tokenIn, waitForMails } from "./mail";

export { PASSWORD };

/**
 * Test accounts use @gmail.com addresses because signup checks that the
 * address's domain really has a mail server. The mail never leaves the machine:
 * the app sends to the local sink, not to Gmail.
 */
export function uniqueEmail(tag = "e2e"): string {
  return `${tag}-${randomBytes(5).toString("hex")}@gmail.com`;
}

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

export function newUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    email: uniqueEmail(),
    password: PASSWORD,
    displayName: "E2E Player",
    ...overrides,
  };
}

/** POST /api/register directly. */
export async function registerViaApi(request: APIRequestContext, user: TestUser) {
  return request.post("/api/register", {
    data: {
      displayName: user.displayName,
      email: user.email,
      password: user.password,
      acceptTerms: true,
    },
  });
}

/**
 * A signed-up, email-confirmed account, made through the real API: register,
 * read the confirmation mail from the sink, use its link. Returns the user and
 * the one-time login ticket the confirmation hands back.
 */
export async function createConfirmedUser(
  request: APIRequestContext,
  overrides: Partial<TestUser> = {},
): Promise<TestUser & { loginToken: string }> {
  const user = newUser(overrides);
  const registered = await registerViaApi(request, user);
  if (!registered.ok()) throw new Error(`register failed: ${registered.status()} ${await registered.text()}`);

  const mails = await waitForMails(user.email, CONFIRM_SUBJECT);
  const verified = await request.post("/api/account/verify-email", {
    data: { token: tokenIn(mails[mails.length - 1]) },
  });
  if (!verified.ok()) throw new Error(`verify failed: ${verified.status()} ${await verified.text()}`);
  const { loginToken } = (await verified.json()) as { loginToken: string };
  return { ...user, loginToken };
}

/**
 * Signs a browser context in without going through the login form (faster):
 * the same CSRF + credentials callback the form uses, with the session cookie
 * landing in the context. Returns whether a session was created.
 */
export async function signInContext(context: BrowserContext, user: TestUser): Promise<boolean> {
  const csrf = await context.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const response = await context.request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email: user.email, password: user.password, json: "true" },
  });
  const cookies = await context.cookies();
  return response.ok() && cookies.some((c) => c.name.includes("session-token"));
}

/**
 * Waits until the page's form (if it has one) is hydrated, so a test doesn't
 * start filling it before React has attached its handlers: submitting earlier
 * falls back to a plain browser form post, which a person (who needs a moment to
 * type) never triggers. React marks every DOM node it has taken over with a
 * "__reactProps$..." property, which is what this waits for.
 */
export async function settled(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => {
    const form = document.querySelector("main form");
    return !form || Object.keys(form).some((key) => key.startsWith("__reactProps"));
  });
}

/** Logs in through the real login form (submits it; the caller checks the outcome). */
export async function loginViaForm(page: Page, user: Pick<TestUser, "email" | "password">) {
  await page.goto("/login");
  await settled(page);
  await page.getByLabel("Email").fill(user.email);
  // exact: the show/hide button is also labelled "Show password".
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

/** Fills and submits the real signup form. */
export async function signUpViaForm(
  page: Page,
  user: TestUser,
  { acceptTerms = true, confirmPassword = user.password } = {},
) {
  await page.goto("/register");
  await settled(page);
  await page.getByLabel("Display name").fill(user.displayName);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm password", { exact: true }).fill(confirmPassword);
  if (acceptTerms) await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
}

/**
 * One credentials login attempt straight against Auth.js, without a browser:
 * the same CSRF + callback the form uses. `code` is Auth.js's error code when it
 * failed (for example "credentials", "email_not_verified", "rate_limited_15").
 * On success the session cookie lands in the request context's cookie jar.
 */
export async function credentialsAttempt(
  request: APIRequestContext,
  user: Pick<TestUser, "email" | "password">,
): Promise<{ signedIn: boolean; code: string | null }> {
  const csrf = await request.get("/api/auth/csrf");
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  // Not following the redirect: a failure redirects back to the login page with the
  // reason in its query string, which is where the code is read from.
  const response = await request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email: user.email, password: user.password },
    maxRedirects: 0,
  });
  const location = response.headers()["location"];
  const code = location ? new URL(location, BASE_URL).searchParams.get("code") : null;
  const cookies = await request.storageState();
  const signedIn = cookies.cookies.some((c) => c.name.includes("session-token"));
  return { signedIn, code };
}
