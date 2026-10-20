import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";

/** The title screen's WebGL canvas: the only one on the page (the clouds are on the setup screen). */
async function particlesCanvasCount(page: Page) {
  return page.locator("canvas").count();
}

test.describe("decorative motion", () => {
  test.describe("with full motion", () => {
    // The rest of the suite runs with reduced motion (it keeps the pages light, which
    // matters most to WebKit), so the animated version gets tests of its own.
    test.use({ reducedMotion: "no-preference" });

    test("a title screen whose WebGL context is revoked the moment it is created stays quiet and usable", async ({
      page,
    }) => {
      // What happens when the browser already has too many contexts open: the new one is
      // lost straight away, the particle shaders never build, and drawing a frame throws.
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
          const context = (original as (...args: unknown[]) => RenderingContext | null).call(this, type, ...rest);
          if (context && /webgl/.test(type)) {
            (context as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
          }
          return context;
        } as typeof HTMLCanvasElement.prototype.getContext;
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("/");
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
      // Plenty of frames, every one of which would have thrown.
      await page.waitForTimeout(1_500);
      expect(errors).toEqual([]);

      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("/setup$"));
    });

    test("the title screen's particle field survives the browser taking its WebGL context away", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("/");
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
      await expect.poll(() => particlesCanvasCount(page)).toBeGreaterThan(0);

      // Take the context away, the way Safari does when too many exist.
      const supported = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
        const lose = gl?.getExtension("WEBGL_lose_context");
        if (!lose) return false;
        lose.loseContext();
        (window as unknown as { __restore: () => void }).__restore = () => lose.restoreContext();
        return true;
      });

      // Frames keep coming; none of them may throw. (Checked even if the context couldn't be
      // taken away above: a browser that had already lost it on its own must not error either.)
      await page.waitForTimeout(1_000);
      expect(errors, "errors after the context was lost").toEqual([]);

      // Given back, the field rebuilds itself rather than staying dead.
      if (supported) {
        await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore());
        await page.waitForTimeout(1_000);
        expect(errors, "errors after the context was restored").toEqual([]);
        await expect.poll(() => particlesCanvasCount(page)).toBeGreaterThan(0);
      }

      // And the page is still perfectly usable.
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("/setup$"));
    });

    test("the setup screen has its sky of animated clouds", async ({ page }) => {
      await page.goto("/setup");
      await expect.poll(() => particlesCanvasCount(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(10);
    });
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("neither the particle field nor the clouds are drawn, and the pages still work", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await particlesCanvasCount(page), "particle canvas on the title screen").toBe(0);

      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("/setup$"));
      await expect(page.getByRole("heading", { name: "Geodex" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await particlesCanvasCount(page), "cloud canvases on the setup screen").toBe(0);
    });
  });
});
