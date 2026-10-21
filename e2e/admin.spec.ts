import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import {
  ADMIN_E2E_PORT,
  ADMIN_TEST_DATABASE_URL,
  TEST_DATABASE_URL,
  assertTestDatabase,
  databaseName,
} from "./support/env";

/**
 * The owner's admin dashboard (admin/): its numbers, its privacy and its security. It runs
 * against its own database (geodex_admin_test) filled with a small, exactly known set of rows,
 * and connects as a login created from the real admin/sql/create-readonly-role.sql, so a query
 * that reached for a column the production login can't read fails here first.
 */
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "The dashboard is a Chromium-only check: it is one page on the owner's computer, not the website.",
);
test.describe.configure({ mode: "serial" });

const ROOT = path.resolve(__dirname, "..");
const BASE = `http://localhost:${ADMIN_E2E_PORT}`;
const RO_ROLE = "geodex_admin_ro_e2e";
const RO_PASSWORD = "e2e-admin-ro-password";
const PANELS = ["overview", "growth", "activity", "rounds", "gameplay", "retention", "traffic", "accounts", "feedback", "operations", "database"];
/** An address-looking marker that must never appear in any panel's output. */
const EMAIL_MARKER = "e2e-admin.invalid";

type AdminApp = { server: http.Server; listen: () => Promise<unknown>; close: () => Promise<void> };
let app: AdminApp | null = null;
let roUrl = "";

const withDatabase = (url: string, user?: string, password?: string) => {
  const u = new URL(url);
  u.search = "";
  if (user) {
    u.username = user;
    u.password = password ?? "";
  }
  return u.toString();
};

async function seed() {
  const owner = new Client({ connectionString: withDatabase(ADMIN_TEST_DATABASE_URL) });
  await owner.connect();
  try {
    await owner.query(
      'TRUNCATE TABLE "User", "EmailToken", "GameResult", "Feedback", "RateLimitHit", "UserActivityDay", "RoundEvent", "DailyCounter", "DailyVisitor" CASCADE',
    );
    const ago = (days: number) => `((now() AT TIME ZONE 'UTC') - interval '${days} days')`;
    // id, days ago created, confirmed, public profile
    const users: Array<[string, number, boolean, boolean]> = [
      ["au1", 0, false, true],
      ["au2", 2, true, true],
      ["au3", 10, true, false],
      ["au4", 10, false, true],
      ["au5", 40, true, true],
      ["au6", 40, true, true],
    ];
    for (const [id, days, confirmed, isPublic] of users) {
      await owner.query(
        `INSERT INTO "User" (id, email, "passwordHash", "displayName", "profilePublic", "createdAt", "updatedAt", "emailVerifiedAt")
         VALUES ($1, $2, 'not-a-real-hash-SECRET', $3, $4, ${ago(days)}, ${ago(days)}, ${confirmed ? ago(days) : "NULL"})`,
        [id, `${id}@${EMAIL_MARKER}`, `Player ${id}`, isPublic],
      );
    }
    const activity: Array<[string, number]> = [["au2", 0], ["au3", 0], ["au2", 1], ["au5", 3], ["au6", 20]];
    for (const [userId, days] of activity) {
      await owner.query(`INSERT INTO "UserActivityDay" ("userId", day) VALUES ($1, (${ago(days)})::date)`, [userId]);
    }
    const results: Array<[string, string, number]> = [["au2", "g1", 0], ["au2", "g2", 2], ["au3", "g3", 10]];
    for (const [userId, id, days] of results) {
      await owner.query(
        `INSERT INTO "GameResult" (id, "userId", mode, difficulty, "roundLength", score, correct, "createdAt", "bestStreak", "neighborCount", "scoringVersion", "totalTimeMs", "roundNonce")
         VALUES ($1, $2, 'NAME', 'EASY', 5, 80, 4, ${ago(days)}, 3, 0, 2, 30000, $3)`,
        [id, userId, `nonce-${id}`],
      );
    }
    const events: Array<[string, string, string | null]> = [
      ["r1", "STARTED", null], ["r2", "STARTED", null], ["r3", "STARTED", null],
      ["r1", "FINISHED", null], ["r2", "ENDED", "LEFT_TAB"],
    ];
    for (const [roundId, kind, endReason] of events) {
      await owner.query(
        `INSERT INTO "RoundEvent" (id, "roundId", kind, mode, difficulty, "roundLength", "signedIn", "endReason", answered, "durationMs", "createdAt")
         VALUES ($1, $2, $3::"RoundEventKind", 'NAME', 'EASY', 5, true, $4::"RoundEndReason", NULL, 30000, now())`,
        [`${roundId}-${kind}`, roundId, kind, endReason],
      );
    }
    for (const [key, count] of [["visitors", 7], ["pageviews", 20], ["signup.created", 1], ["login.failed", 4]] as const) {
      await owner.query(`INSERT INTO "DailyCounter" (day, key, count) VALUES ((now() AT TIME ZONE 'UTC')::date, $1, $2)`, [key, count]);
    }
    await owner.query(
      `INSERT INTO "Feedback" (id, kind, subject, description, "createdAt", "attachmentCount")
       VALUES ('f1', 'BUG', 'A bug', 'Something broke', ${ago(0)}, 0), ('f2', 'FEEDBACK', 'An idea', 'Add a thing', ${ago(20)}, 0)`,
    );
  } finally {
    await owner.end();
  }
}

test.beforeAll(async () => {
  test.setTimeout(180_000);
  assertTestDatabase(TEST_DATABASE_URL);
  assertTestDatabase(ADMIN_TEST_DATABASE_URL);

  // Create the database, bring it to the current schema, and create the restricted login from the real SQL file.
  const maintenance = new URL(TEST_DATABASE_URL);
  maintenance.pathname = "/postgres";
  maintenance.search = "";
  const maintenanceClient = new Client({ connectionString: maintenance.toString() });
  await maintenanceClient.connect();
  const name = databaseName(ADMIN_TEST_DATABASE_URL);
  if ((await maintenanceClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [name])).rowCount === 0) {
    await maintenanceClient.query(`CREATE DATABASE "${name}"`);
  }
  await maintenanceClient.end();
  execSync("npx prisma migrate deploy", { cwd: ROOT, env: { ...process.env, DATABASE_URL: ADMIN_TEST_DATABASE_URL }, stdio: "pipe" });

  const owner = new Client({ connectionString: withDatabase(ADMIN_TEST_DATABASE_URL) });
  await owner.connect();
  const roleSql = readFileSync(path.join(ROOT, "admin/sql/create-readonly-role.sql"), "utf8")
    .replaceAll("geodex_admin_ro", RO_ROLE)
    .replace("CHANGE-ME-to-a-long-random-password", RO_PASSWORD);
  await owner.query(roleSql);
  await owner.query(`ALTER ROLE ${RO_ROLE} PASSWORD '${RO_PASSWORD}'`);
  await owner.end();
  roUrl = withDatabase(ADMIN_TEST_DATABASE_URL, RO_ROLE, RO_PASSWORD);

  await seed();

  const { createAdminServer } = (await import(pathToFileURL(path.join(ROOT, "admin/lib/server.mjs")).href)) as {
    createAdminServer: (config: object) => AdminApp;
  };
  app = createAdminServer({ demo: false, databaseUrl: roUrl, port: ADMIN_E2E_PORT, emailDailyLimit: 400 });
  await app.listen();
});

test.afterAll(async () => {
  await app?.close();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function panel(name: string, query = "days=30&tz=0"): Promise<any> {
  const response = await fetch(`${BASE}/api/${name}?${query}`);
  expect(response.status, `${name} panel`).toBe(200);
  return ((await response.json()) as { data: unknown }).data;
}

/** A raw request with a header fetch() won't let a script set (Host). */
function rawGet(pathname: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: ADMIN_E2E_PORT, path: pathname, method: "GET", headers }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end();
  });
}

test.describe("the numbers", () => {
  test("overview counts accounts, activity, rounds, traffic today and feedback exactly", async () => {
    const d = await panel("overview");
    expect(d.users).toMatchObject({ total: 6, confirmed: 4, unconfirmed: 2, unconfirmed_stale: 1, today: 1, last7: 2, last30: 4, public_profiles: 5, confirmationRate: 66.7 });
    expect(d.active).toMatchObject({ dau: 2, wau: 3, mau: 4 });
    expect(d.rounds).toMatchObject({ total: 3, today: 1, last7: 2 });
    expect(d.events).toMatchObject({ started: 3, finished: 1, ended: 1 });
    expect(d.today).toEqual({ visitors: 7, pageviews: 20, signups: 1 });
    expect(d.feedback).toEqual({ total: 2, last7: 1 });
  });

  test("rounds funnel and daily series add up", async () => {
    const d = await panel("rounds");
    expect(d.funnel).toMatchObject({ started: 3, finished: 1, left_tab: 1, guest_started: 0, signed_in_started: 3 });
    expect(d.daily).toHaveLength(30);
    expect(d.daily.at(-1)).toMatchObject({ started: 3, finished: 1, left_tab: 1 });
    expect(d.heatmap).toHaveLength(7);
  });

  test("growth series covers the range and ends at the total", async () => {
    const d = await panel("growth", "days=7&tz=0");
    expect(d.daily).toHaveLength(7);
    expect(d.daily.at(-1)).toMatchObject({ signups: 1, total: 6 });
  });

  test("feedback and operations read the right rows", async () => {
    const f = await panel("feedback");
    expect(f.totals).toMatchObject({ total: 2, bugs: 1, ideas: 1 });
    const o = await panel("operations");
    expect(o.counters.find((c: { key: string }) => c.key === "login.failed")?.count).toBe(4);
    expect(o.emailBudget).toMatchObject({ used: 0, limit: 400 });
  });

  test("the range is clamped, not trusted", async () => {
    expect((await panel("growth", "days=100000&tz=0")).daily).toHaveLength(365);
    expect((await panel("growth", "days=abc&tz=0")).daily).toHaveLength(30);
  });
});

test.describe("privacy", () => {
  test("no panel ever returns an email address, a password hash or a token", async () => {
    let everything = "";
    for (const name of PANELS) everything += JSON.stringify(await panel(name, "days=365&tz=0"));
    expect(everything).not.toContain(EMAIL_MARKER);
    expect(everything).not.toContain("SECRET");
    expect(everything).not.toContain("nonce-");
    expect(everything).not.toMatch(/passwordHash|roundNonce|ipHash/);
  });

  test("the restricted login cannot read emails, tokens or hashed keys, or write anything", async () => {
    const client = new Client({ connectionString: roUrl });
    await client.connect();
    try {
      await expect(client.query('SELECT email FROM "User"')).rejects.toThrow(/permission denied/);
      await expect(client.query('SELECT "passwordHash" FROM "User"')).rejects.toThrow(/permission denied/);
      await expect(client.query('SELECT * FROM "EmailToken"')).rejects.toThrow(/permission denied/);
      await expect(client.query('SELECT key FROM "RateLimitHit"')).rejects.toThrow(/permission denied/);
      await expect(client.query('SELECT hash FROM "DailyVisitor"')).rejects.toThrow(/permission denied/);
      await expect(client.query('SELECT "roundNonce" FROM "GameResult"')).rejects.toThrow(/permission denied/);
      await expect(client.query(`UPDATE "User" SET "displayName" = 'x'`)).rejects.toThrow(/read-only|permission denied/);
      await expect(client.query('DELETE FROM "Feedback"')).rejects.toThrow(/read-only|permission denied/);
    } finally {
      await client.end();
    }
  });
});

test.describe("security", () => {
  test("a request naming another host is refused (DNS rebinding)", async () => {
    expect(await rawGet("/api/overview", { Host: `evil.example:${ADMIN_E2E_PORT}` })).toBe(403);
    expect(await rawGet("/", { Host: "evil.example" })).toBe(403);
    expect(await rawGet("/api/overview", { Host: `localhost:${ADMIN_E2E_PORT}` })).toBe(200);
  });

  test("a request from another website is refused", async () => {
    expect(await rawGet("/api/overview", { Host: `localhost:${ADMIN_E2E_PORT}`, Origin: "https://evil.example" })).toBe(403);
    expect(await rawGet("/api/overview", { Host: `localhost:${ADMIN_E2E_PORT}`, "Sec-Fetch-Site": "cross-site" })).toBe(403);
  });

  test("only GET is answered, unknown panels 404, and responses carry security headers", async () => {
    expect((await fetch(`${BASE}/api/overview`, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${BASE}/api/users`)).status).toBe(404);
    expect((await fetch(`${BASE}/api/__proto__`)).status).toBe(404);
    expect((await fetch(`${BASE}/../package.json`)).status).toBe(404);
    const response = await fetch(`${BASE}/`);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("it listens on the loopback address only", () => {
    expect(app?.server.address()).toMatchObject({ address: "127.0.0.1", port: ADMIN_E2E_PORT });
  });
});

test.describe("the page", () => {
  test("every tab loads with its numbers and charts and without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE);
    await expect(page.getByRole("heading", { name: "Geodex admin" })).toBeVisible();
    await expect(page.locator(".kpi", { hasText: "Registered accounts" }).locator(".value")).toHaveText("6");

    for (const [key, name] of [["growth", "Growth"], ["activity", "Activity"], ["rounds", "Rounds"], ["gameplay", "Gameplay"], ["retention", "Retention"], ["traffic", "Traffic"], ["accounts", "Accounts"], ["feedback", "Feedback"], ["operations", "Operations"], ["database", "Database"]]) {
      await page.getByRole("tab", { name }).click();
      await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
      await expect(page.locator(".card").first()).toBeVisible();
      await expect(page.locator(".error")).toHaveCount(0);
      expect(page.url()).toContain(`#${key}`);
    }
    await page.getByRole("tab", { name: "Rounds" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("changing the range reloads the data", async ({ page }) => {
    await page.goto(`${BASE}/#growth`);
    await expect(page.locator(".card").first()).toBeVisible();
    const requests: string[] = [];
    page.on("request", (r) => r.url().includes("/api/growth") && requests.push(r.url()));
    await page.locator("#range").selectOption("90");
    await expect.poll(() => requests.some((u) => u.includes("days=90"))).toBe(true);
  });
});
