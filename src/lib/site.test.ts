import { afterEach, describe, expect, it, vi } from "vitest";
import { isProductionDeploy, siteUrl } from "./site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://geodex.example");
    vi.stubEnv("URL", "https://other.netlify.app");
    expect(siteUrl()).toBe("https://geodex.example");
  });

  it("falls back to Netlify's URL, then to localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("URL", "https://geodex.netlify.app");
    expect(siteUrl()).toBe("https://geodex.netlify.app");

    vi.stubEnv("URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("drops trailing slashes so paths can be appended", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://geodex.example///");
    expect(siteUrl()).toBe("https://geodex.example");
  });
});

describe("isProductionDeploy", () => {
  it("is true for the real site and when CONTEXT isn't set", () => {
    vi.stubEnv("CONTEXT", "production");
    expect(isProductionDeploy()).toBe(true);
    vi.stubEnv("CONTEXT", "");
    expect(isProductionDeploy()).toBe(true);
  });

  it("is false for Netlify previews and branch deploys", () => {
    vi.stubEnv("CONTEXT", "deploy-preview");
    expect(isProductionDeploy()).toBe(false);
    vi.stubEnv("CONTEXT", "branch-deploy");
    expect(isProductionDeploy()).toBe(false);
  });
});
