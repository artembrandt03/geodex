import type { Locator } from "@playwright/test";

/**
 * A click that skips Playwright's "wait until the element is stable" step.
 *
 * That step watches the element across two animation frames, and Playwright's
 * experimental WebKit-on-Windows build sometimes simply stops delivering frames:
 * the click then waits for the rest of the test's time limit while the page itself
 * is perfectly fine (the trace shows it fully rendered). It hung exactly like this on
 * "Play", "Resend the confirmation email" and "Sign out" in different runs.
 *
 * Use it for a click where that has been seen to happen. Everything else about the
 * click is unchanged: it still scrolls the button into view and presses it with real
 * mouse input, which is more faithful than dispatching a synthetic click event.
 */
export async function click(locator: Locator): Promise<void> {
  await locator.click({ force: true });
}
