import { describe, expect, it } from "vitest";
import {
  browserFamily,
  deviceClass,
  isBot,
  pageKey,
  referrerSource,
  utcDayString,
  visitorHash,
} from "./classify";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const EDGE_WIN = `${CHROME_WIN} Edg/126.0.0.0`;
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0";

describe("isBot", () => {
  it("recognises crawlers, previewers, monitors and automated browsers", () => {
    for (const ua of [
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "facebookexternalhit/1.1",
      "Mozilla/5.0 HeadlessChrome/126.0.0.0 Safari/537.36",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "Mozilla/5.0 (X11; Linux) AppleWebKit/537.36 Lighthouse",
    ]) {
      expect(isBot(ua), ua).toBe(true);
    }
  });

  it("treats a missing or tiny user agent as a bot", () => {
    expect(isBot(null)).toBe(true);
    expect(isBot(undefined)).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot("x")).toBe(true);
  });

  it("lets real browsers through", () => {
    for (const ua of [CHROME_WIN, EDGE_WIN, SAFARI_MAC, IPHONE, ANDROID_PHONE, FIREFOX]) {
      expect(isBot(ua), ua).toBe(false);
    }
  });
});

describe("deviceClass", () => {
  it("tells phones, tablets and computers apart", () => {
    expect(deviceClass(IPHONE)).toBe("mobile");
    expect(deviceClass(ANDROID_PHONE)).toBe("mobile");
    expect(deviceClass(IPAD)).toBe("tablet");
    expect(deviceClass(ANDROID_TABLET)).toBe("tablet");
    expect(deviceClass(CHROME_WIN)).toBe("desktop");
    expect(deviceClass(SAFARI_MAC)).toBe("desktop");
    expect(deviceClass(FIREFOX)).toBe("desktop");
  });
});

describe("browserFamily", () => {
  it("names the browser, not the engines it also claims to be", () => {
    expect(browserFamily(CHROME_WIN)).toBe("chrome");
    expect(browserFamily(EDGE_WIN)).toBe("edge");
    expect(browserFamily(SAFARI_MAC)).toBe("safari");
    expect(browserFamily(IPHONE)).toBe("safari");
    expect(browserFamily(FIREFOX)).toBe("firefox");
    expect(browserFamily(`${CHROME_WIN} OPR/110.0.0.0`)).toBe("opera");
    expect(browserFamily(`${CHROME_WIN} SamsungBrowser/25.0`)).toBe("samsung");
    expect(browserFamily("SomethingElse/1.0 (unknown platform)")).toBe("other");
  });

  it("recognises Chrome and Firefox on iOS, which are WebKit underneath", () => {
    expect(browserFamily(`${IPHONE.replace("Version/17.5 ", "")} CriOS/126.0 Mobile`)).toBe("chrome");
    expect(browserFamily(`${IPHONE} FxiOS/127.0`)).toBe("firefox");
  });
});

describe("pageKey", () => {
  it("maps real pages to their route", () => {
    expect(pageKey("/")).toBe("/");
    expect(pageKey("/setup")).toBe("/setup");
    expect(pageKey("/leaderboard")).toBe("/leaderboard");
    expect(pageKey("/privacy")).toBe("/privacy");
  });

  it("ignores trailing slashes, query strings and fragments", () => {
    expect(pageKey("/about/")).toBe("/about");
    expect(pageKey("/leaderboard?mode=NAME&difficulty=HARD")).toBe("/leaderboard");
    expect(pageKey("/verify-email?token=abc123#x")).toBe("/verify-email");
  });

  it("never keeps a player's id", () => {
    expect(pageKey("/players/cmv05nymw000ejkrwteju4snx")).toBe("/players/:id");
  });

  it("collapses anything unknown so strangers can't invent keys", () => {
    expect(pageKey("/wp-login.php")).toBe("other");
    expect(pageKey("/players")).toBe("other");
    expect(pageKey("/players/a/b")).toBe("other");
    expect(pageKey("/api/profile")).toBe("other");
    expect(pageKey("/" + "x".repeat(5000))).toBe("other");
  });
});

describe("referrerSource", () => {
  it("is direct with no referrer, an unparseable one, or the site itself", () => {
    expect(referrerSource("", "geodex.example")).toBe("direct");
    expect(referrerSource(null, "geodex.example")).toBe("direct");
    expect(referrerSource("not a url", "geodex.example")).toBe("direct");
    expect(referrerSource("https://geodex.example/setup", "geodex.example")).toBe("direct");
    expect(referrerSource("https://www.geodex.example/", "geodex.example")).toBe("direct");
    expect(referrerSource("https://geodex.example:3000/", "geodex.example:3000")).toBe("direct");
  });

  it("buckets well-known sources", () => {
    expect(referrerSource("https://www.google.com/", "geodex.example")).toBe("google");
    expect(referrerSource("https://www.google.ca/search?q=geodex", "geodex.example")).toBe("google");
    expect(referrerSource("https://t.co/abc", "geodex.example")).toBe("x");
    expect(referrerSource("https://old.reddit.com/r/geography", "geodex.example")).toBe("reddit");
    expect(referrerSource("https://github.com/artembrandt03/geodex", "geodex.example")).toBe("github");
    expect(referrerSource("https://artembrandt.ca/", "geodex.example")).toBe("artembrandt.ca");
  });

  it("puts everything else in one bucket rather than storing the host", () => {
    expect(referrerSource("https://some-random-blog.example/post", "geodex.example")).toBe("other");
  });
});

describe("visitorHash", () => {
  it("is stable within a day for the same visitor", () => {
    expect(visitorHash("s", "2026-10-21", "1.2.3.4", CHROME_WIN)).toBe(visitorHash("s", "2026-10-21", "1.2.3.4", CHROME_WIN));
  });

  it("changes with the day, the address and the browser, so days can't be linked", () => {
    const base = visitorHash("s", "2026-10-21", "1.2.3.4", CHROME_WIN);
    expect(visitorHash("s", "2026-10-22", "1.2.3.4", CHROME_WIN)).not.toBe(base);
    expect(visitorHash("s", "2026-10-21", "1.2.3.5", CHROME_WIN)).not.toBe(base);
    expect(visitorHash("s", "2026-10-21", "1.2.3.4", FIREFOX)).not.toBe(base);
    expect(visitorHash("other-secret", "2026-10-21", "1.2.3.4", CHROME_WIN)).not.toBe(base);
  });

  it("does not contain the address", () => {
    const hash = visitorHash("s", "2026-10-21", "203.0.113.77", CHROME_WIN);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain("203");
  });
});

describe("utcDayString", () => {
  it("is the UTC calendar day, whatever the local time zone", () => {
    expect(utcDayString(new Date("2026-10-21T23:59:59.000Z"))).toBe("2026-10-21");
    expect(utcDayString(new Date("2026-10-22T00:00:00.000Z"))).toBe("2026-10-22");
  });
});
