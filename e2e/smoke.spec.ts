import { expect, test, type Page } from "@playwright/test";

/**
 * Every error the page reports while a test runs: uncaught exceptions and console
 * errors. Safari words a fetch that was aborted by navigating away as "Load
 * failed" or "due to access control checks"; that's the test moving on, not a
 * bug, so those are ignored.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  const record = (text: string) => {
    if (!/Load failed|due to access control checks/.test(text)) errors.push(text);
  };
  page.on("pageerror", (error) => record(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") record(`console: ${message.text()}`);
  });
  return errors;
}

const PUBLIC_PAGES = [
  "/",
  "/setup",
  "/about",
  "/leaderboard",
  "/login",
  "/register",
  "/forgot-password",
  "/privacy",
  "/terms",
];

test.describe("smoke and pages", () => {
  test("the title screen leads into the game setup", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Developed by")).toBeVisible();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByRole("heading", { name: "Geodex" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Mode$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Difficulty$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Round length$/i })).toBeVisible();
  });

  test("every public page loads cleanly, with no errors and no sideways overflow", async ({ page }) => {
    const errors = collectErrors(page);
    for (const path of PUBLIC_PAGES) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} status`).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} horizontal overflow (px)`).toBeLessThanOrEqual(0);
    }
    expect(errors).toEqual([]);
  });

  test("an unknown address gets the friendly 404 with a real 404 status", async ({ page }) => {
    const response = await page.goto("/no-such-page-here");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Uncharted territory" })).toBeVisible();
    await expect(page).toHaveTitle(/Page not found/);
  });

  test("robots.txt and the sitemap are served and consistent", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    const robotsText = await robots.text();
    expect(robotsText).toContain("Disallow: /api/");
    expect(robotsText).toContain("Disallow: /verify-email");
    expect(robotsText).toContain("Sitemap:");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const sitemapText = await sitemap.text();
    for (const path of ["/setup", "/leaderboard", "/about", "/privacy", "/terms"]) {
      expect(sitemapText, `sitemap lists ${path}`).toContain(path);
    }
    // Private and account pages must never be advertised to search engines.
    expect(sitemapText).not.toContain("/profile");
    expect(sitemapText).not.toContain("/login");
  });

  test("the About page shows its three windows and the source code link", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About me" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "About the project" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "News & updates" })).toBeVisible();
    const github = page.getByRole("link", { name: /View on GitHub/ });
    await expect(github).toHaveAttribute("href", /github\.com\/artembrandt03\/geodex/);
    await expect(page.getByRole("link", { name: "Privacy Policy" }).first()).toBeVisible();
  });
});
