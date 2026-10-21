import { randomBytes } from "node:crypto";
import { expect, test } from "./support/test";
import { query, userByEmail } from "./support/db";
import { E2E_AUTH_SECRET } from "./support/env";
import { utcDayString, visitorHash } from "../src/lib/analytics/classify";
import {
  createConfirmedUser,
  credentialsAttempt,
  newUser,
  registerViaApi,
  signInContext,
  uniqueEmail,
} from "./support/users";

/** A browser string that isn't mistaken for a robot (Playwright's own says "HeadlessChrome"). */
const REAL_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const ROUND = { mode: "NAME", difficulty: "EASY", roundLength: 5 } as const;

/** The id inside a round token (its first dot-separated part is base64url JSON). */
function roundIdOf(token: string): string {
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")).id;
}

async function counter(key: string): Promise<number> {
  const rows = await query<{ count: number }>(
    `SELECT coalesce(sum("count"), 0)::int AS count FROM "DailyCounter" WHERE "key" = $1 AND "day" = (now() AT TIME ZONE 'UTC')::date`,
    [key],
  );
  return rows[0].count;
}

async function visitorRows(hash: string): Promise<number> {
  const rows = await query<{ n: string }>(`SELECT count(*)::text AS n FROM "DailyVisitor" WHERE "hash" = $1`, [hash]);
  return Number(rows[0].n);
}

test.describe("usage statistics: what gets recorded", () => {
  test("a visitor is counted once a day, with only coarse buckets, and the unique-visitor hash holds no address", async ({
    request,
    clientIp,
  }) => {
    // A browser string only this test uses, so its visitor can be told apart from every other test's.
    const ua = `${REAL_UA} e2e-${randomBytes(4).toString("hex")}`;
    const hash = visitorHash(E2E_AUTH_SECRET, utcDayString(), clientIp, ua);
    const views = await counter("pageviews");
    const visitors = await counter("visitors");

    for (const path of ["/", "/setup", "/leaderboard?mode=NAME&difficulty=HARD", "/players/some-player-id"]) {
      const response = await request.post("/api/analytics/view", {
        headers: { "user-agent": ua },
        data: { path, referrer: "https://www.google.com/search?q=geodex" },
      });
      expect(response.status()).toBe(204);
    }

    // Four page views from one visitor: the visitor is stored once, and as a hash only.
    expect(await visitorRows(hash)).toBe(1);
    expect(await counter("pageviews")).toBeGreaterThanOrEqual(views + 4);
    expect(await counter("visitors")).toBeGreaterThanOrEqual(visitors + 1);

    const stored = await query<{ hash: string }>(`SELECT "hash" FROM "DailyVisitor" WHERE "hash" = $1`, [hash]);
    expect(stored[0].hash).not.toContain(clientIp);
    expect(stored[0].hash).toMatch(/^[0-9a-f]{32}$/);

    // Every page key is a known route: a player's id and a query string never become a key.
    const keys = await query<{ key: string }>(`SELECT DISTINCT "key" FROM "DailyCounter" WHERE "key" LIKE 'pageviews.page:%'`);
    const allowed = new Set([
      "/", "/setup", "/play", "/leaderboard", "/about", "/login", "/register", "/forgot-password",
      "/reset-password", "/verify-email", "/profile", "/players/:id", "/privacy", "/terms", "other",
    ]);
    for (const { key } of keys) expect(allowed.has(key.replace("pageviews.page:", "")), key).toBe(true);
    expect(keys.map((k) => k.key)).toContain("pageviews.page:/players/:id");
    expect(JSON.stringify(keys)).not.toContain("some-player-id");

    // Device, browser and referrer are counted as buckets.
    expect(await counter("visitors.device:mobile")).toBeGreaterThanOrEqual(1);
    expect(await counter("visitors.browser:safari")).toBeGreaterThanOrEqual(1);
    expect(await counter("visitors.source:google")).toBeGreaterThanOrEqual(1);
  });

  test("Do Not Track, Global Privacy Control and robots are not counted at all", async ({ request, clientIp }) => {
    const base = `${REAL_UA} e2e-${randomBytes(4).toString("hex")}`;
    const cases: { name: string; ua: string; headers: Record<string, string> }[] = [
      { name: "Do Not Track", ua: `${base} dnt`, headers: { dnt: "1" } },
      { name: "Global Privacy Control", ua: `${base} gpc`, headers: { "sec-gpc": "1" } },
      { name: "a crawler", ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", headers: {} },
      { name: "headless automation", ua: `${base} HeadlessChrome/126`, headers: {} },
    ];
    for (const c of cases) {
      const before = await counter("pageviews");
      const response = await request.post("/api/analytics/view", {
        headers: { "user-agent": c.ua, ...c.headers },
        data: { path: "/setup" },
      });
      expect(response.status(), c.name).toBe(204);
      expect(await visitorRows(visitorHash(E2E_AUTH_SECRET, utcDayString(), clientIp, c.ua)), c.name).toBe(0);
      void before; // other tests move the shared counters, so only this visitor's row is checked
    }

    // A malformed report is refused rather than guessed at.
    const bad = await request.post("/api/analytics/view", { headers: { "user-agent": REAL_UA }, data: { nope: 1 } });
    expect(bad.status()).toBe(400);
  });

  test("a page view in a real browser reports the path only, never the query string", async ({ browser }) => {
    const context = await browser.newContext({ userAgent: REAL_UA });
    const page = await context.newPage();
    const reported = page.waitForRequest(
      (r) => r.url().endsWith("/api/analytics/view") && r.postDataJSON()?.path === "/leaderboard",
      { timeout: 20_000 },
    );
    await page.goto("/leaderboard?mode=SHAPE&difficulty=HARD&roundLength=20");
    const request = await reported;
    expect(request.postDataJSON()).toEqual({ path: "/leaderboard", referrer: "" });
    await context.close();
  });

  test("round events are anonymous, recorded once each, and carry a server-measured duration", async ({
    request,
  }) => {
    const started = await request.post("/api/rounds/start", { data: ROUND });
    expect(started.status()).toBe(200);
    const { token } = (await started.json()) as { token: string };
    const roundId = roundIdOf(token);

    // Starting recorded an anonymous event: a guest, with nothing about who.
    const rows = await query<Record<string, unknown>>(`SELECT * FROM "RoundEvent" WHERE "roundId" = $1`, [roundId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "STARTED", mode: "NAME", difficulty: "EASY", roundLength: 5, signedIn: false });
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["answered", "createdAt", "difficulty", "durationMs", "endReason", "id", "kind", "mode", "roundId", "roundLength", "signedIn"],
    );

    // Finishing, reported twice, is one event.
    for (let i = 0; i < 2; i++) {
      const done = await request.post("/api/rounds/event", { data: { roundToken: token, kind: "finished", answered: 5 } });
      expect(done.status()).toBe(204);
    }
    const finished = await query<{ answered: number; durationMs: number; endReason: string | null }>(
      `SELECT "answered", "durationMs", "endReason" FROM "RoundEvent" WHERE "roundId" = $1 AND "kind" = 'FINISHED'`,
      [roundId],
    );
    expect(finished).toHaveLength(1);
    expect(finished[0].answered).toBe(5);
    expect(finished[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(finished[0].durationMs).toBeLessThan(60_000);
    expect(finished[0].endReason).toBeNull();
  });

  test("an early ending records why, and invalid events are refused", async ({ request }) => {
    const { token } = (await (await request.post("/api/rounds/start", { data: ROUND })).json()) as { token: string };

    expect((await request.post("/api/rounds/event", { data: { roundToken: token, kind: "ended", reason: "left_tab", answered: 2 } })).status()).toBe(204);
    const ended = await query<{ endReason: string; answered: number }>(
      `SELECT "endReason", "answered" FROM "RoundEvent" WHERE "roundId" = $1 AND "kind" = 'ENDED'`,
      [roundIdOf(token)],
    );
    expect(ended).toEqual([{ endReason: "LEFT_TAB", answered: 2 }]);

    const refused: Record<string, unknown> = {
      "a made-up token": { roundToken: "not.a-real-token", kind: "finished", answered: 5 },
      "more answered than the round has": { roundToken: token, kind: "finished", answered: 6 },
      "an ending with no reason": { roundToken: token, kind: "ended", answered: 1 },
      "an unknown kind": { roundToken: token, kind: "exploded", answered: 1 },
      "no body": {},
    };
    for (const [what, data] of Object.entries(refused)) {
      expect((await request.post("/api/rounds/event", { data })).status(), what).toBe(400);
    }
  });

  test("starting rounds is limited per IP, so a script can't fill the table", async ({ request }) => {
    const statuses: number[] = [];
    for (let i = 0; i < 62; i++) {
      statuses.push((await request.post("/api/rounds/start", { data: ROUND })).status());
    }
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(60)).toEqual([429, 429]);
  });

  test("a signed-in player is marked active for the day by logging in, starting a round and opening a page", async ({
    request,
    context,
  }) => {
    const user = await createConfirmedUser(request);
    const id = (await userByEmail(user.email))!.id;
    const activeDays = async () =>
      Number(
        (await query<{ n: string }>(`SELECT count(*)::text AS n FROM "UserActivityDay" WHERE "userId" = $1`, [id]))[0].n,
      );

    // Confirming the address isn't activity yet.
    expect(await activeDays()).toBe(0);

    // Logging in is: and doing more on the same day doesn't add rows (one per account per day).
    expect((await credentialsAttempt(request, user)).signedIn).toBe(true);
    expect(await activeDays()).toBe(1);

    expect(await signInContext(context, user)).toBe(true);
    await context.request.post("/api/rounds/start", { data: ROUND });
    await context.request.post("/api/analytics/view", { headers: { "user-agent": REAL_UA }, data: { path: "/setup" } });
    expect(await activeDays()).toBe(1);

    // The day is today in UTC, and the rows go when the account does.
    const today = (await query<{ same: boolean }>(
      `SELECT ("day" = (now() AT TIME ZONE 'UTC')::date) AS same FROM "UserActivityDay" WHERE "userId" = $1`,
      [id],
    ))[0];
    expect(today.same).toBe(true);
    await query(`DELETE FROM "User" WHERE id = $1`, [id]);
    expect(await activeDays()).toBe(0);
  });

  test("signups, logins, emails and refusals are counted by outcome, as numbers only", async ({ request }) => {
    const watched = [
      "signup.created",
      "signup.refused.disposable",
      "signup.refused.nomx",
      "signup.refused.exists",
      "email.sent.verify",
      "email.sent.reset",
      "login.success",
      "login.failed",
      "verify.success",
      "reset.requested",
      "reset.success",
    ];
    const before = Object.fromEntries(await Promise.all(watched.map(async (k) => [k, await counter(k)])));

    // A refused signup of each kind.
    await registerViaApi(request, newUser({ email: `e2e-${randomBytes(3).toString("hex")}@mailinator.com` }));
    await registerViaApi(request, newUser({ email: "nonexistent@poop.com" }));
    // A real signup, its confirmation, a duplicate attempt, a login, a failed login, a reset.
    const user = await createConfirmedUser(request);
    await registerViaApi(request, user);
    await credentialsAttempt(request, user);
    await credentialsAttempt(request, { email: user.email, password: "wrong-password-1" });
    await request.post("/api/account/forgot-password", { data: { email: user.email } });
    await request.post("/api/account/forgot-password", { data: { email: uniqueEmail("nobody") } });

    for (const key of [
      "signup.created",
      "signup.refused.disposable",
      "signup.refused.nomx",
      "signup.refused.exists",
      "email.sent.verify",
      "email.sent.reset",
      "login.success",
      "login.failed",
      "verify.success",
      "reset.requested",
    ]) {
      expect(await counter(key), key).toBeGreaterThan(before[key]);
    }
    // Two reset requests were counted, though only one had an account (counts never say which).
    expect((await counter("reset.requested")) - before["reset.requested"]).toBeGreaterThanOrEqual(2);

    // Counters hold a day, a name and a number, nothing else.
    const columns = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'DailyCounter' ORDER BY column_name`,
    );
    expect(columns.map((c) => c.column_name)).toEqual(["count", "day", "key"]);
  });
});
