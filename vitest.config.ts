import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The Playwright end-to-end specs in e2e/ run with `npm run test:e2e`, not here.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
