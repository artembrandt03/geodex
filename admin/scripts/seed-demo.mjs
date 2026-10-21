/**
 * Fills a database with 150 days of made-up activity, so the dashboard has something to show
 * before real players exist: `npm run admin:seed-demo`, then `npm run admin:demo`.
 *
 * Safety: it only ever writes to a database whose name ends in "_demo" (default: the local
 * geodex_demo), creating it if needed, and it wipes that database first. Everything it
 * invents is obviously fake (addresses are @demo.invalid, which can never be a real inbox),
 * and the random numbers are seeded, so the picture is the same every time.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { LOCAL_DEMO_URL } from "../lib/config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DAYS = 150;
const url = process.env.ADMIN_DEMO_DATABASE_URL ?? LOCAL_DEMO_URL;
const dbName = new URL(url).pathname.replace(/^\//, "");
if (!dbName.endsWith("_demo")) {
  console.error(`Refusing to seed "${dbName}": the demo database's name must end in "_demo".`);
  process.exit(1);
}

/** A small seeded random number generator (mulberry32), so the demo data is repeatable. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261021);
const pick = (items) => items[Math.floor(rand() * items.length)];
const chance = (p) => rand() < p;
const between = (lo, hi) => lo + rand() * (hi - lo);
const poisson = (mean) => {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > limit);
  return k - 1;
};
const weighted = (entries) => {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [value, w] of entries) if ((r -= w) <= 0) return value;
  return entries[entries.length - 1][0];
};

// --- the database ---------------------------------------------------------------------------
const maintenance = new URL(url);
maintenance.pathname = "/postgres";
maintenance.search = "";
const admin = new pg.Client({ connectionString: maintenance.toString() });
await admin.connect();
if ((await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName])).rowCount === 0) {
  await admin.query(`CREATE DATABASE "${dbName}"`);
  console.log(`created database ${dbName}`);
}
await admin.end();

console.log("applying migrations...");
execSync("npx prisma migrate deploy", { cwd: ROOT, env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });

const dataUrl = new URL(url);
dataUrl.search = "";
const db = new pg.Client({ connectionString: dataUrl.toString() });
await db.connect();
await db.query(
  'TRUNCATE TABLE "User", "EmailToken", "GameResult", "Feedback", "RateLimitHit", "UserActivityDay", "RoundEvent", "DailyCounter", "DailyVisitor" CASCADE',
);

/** Multi-row insert in chunks, with optional casts per column (for enums, dates). */
async function insertMany(table, columns, rows, casts = {}) {
  if (rows.length === 0) return;
  const chunk = Math.max(1, Math.floor(60000 / columns.length));
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params = [];
    const tuples = part.map((row) => {
      const marks = row.map((value, c) => {
        params.push(value);
        return `$${params.length}${casts[columns[c]] ? `::${casts[columns[c]]}` : ""}`;
      });
      return `(${marks.join(",")})`;
    });
    await db.query(`INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES ${tuples.join(",")}`, params);
  }
}

// --- the calendar ---------------------------------------------------------------------------
const startOfToday = new Date();
startOfToday.setUTCHours(0, 0, 0, 0);
const dayStart = (offset) => new Date(startOfToday.getTime() - offset * 86_400_000); // offset 0 = today
const iso = (date) => date.toISOString().slice(0, 10);
/** Hours people play at: quiet at night, busy in the evening (UTC; the dashboard shifts to local time). */
const HOUR_WEIGHTS = [2, 1, 1, 1, 1, 1, 2, 3, 4, 4, 5, 5, 6, 6, 6, 7, 8, 10, 13, 15, 14, 11, 7, 4].map((w, h) => [h, w]);
const at = (date, hour = weighted(HOUR_WEIGHTS)) => new Date(date.getTime() + hour * 3_600_000 + Math.floor(rand() * 3_600_000));

// --- users ----------------------------------------------------------------------------------
const FIRST = ["Atlas", "Nova", "Maple", "Cedar", "Pixel", "Orbit", "Luna", "Kite", "Birch", "Sage", "Echo", "Rook", "Ember", "Finch", "Quill", "Zephyr", "Moss", "Dune", "Reef", "Tundra"];
const SECOND = ["Fox", "Owl", "Wanderer", "Voyager", "Scout", "Navigator", "Cartographer", "Drifter", "Pilot", "Explorer", "Sailor", "Ranger"];
const users = [];
const confirmedUsers = [];
for (let offset = DAYS - 1; offset >= 0; offset--) {
  const age = DAYS - 1 - offset; // 0 = first day
  const trend = 1.2 + age / 28; // slow growth
  const launchSpike = age >= 88 && age <= 92 ? 9 : 1; // a day or two of attention
  const weekend = [0, 6].includes(dayStart(offset).getUTCDay()) ? 1.4 : 1;
  const count = poisson(trend * launchSpike * weekend);
  for (let n = 0; n < count; n++) {
    const index = users.length;
    const createdAt = at(dayStart(offset));
    if (createdAt > new Date()) continue;
    const confirmed = chance(0.78);
    // Most confirm within minutes; some within hours; a few a day later.
    const delayMinutes = chance(0.85) ? -Math.log(1 - rand()) * 6 : between(60, 1700);
    const user = {
      id: `demo_u${index}`,
      email: `demo-${index}@demo.invalid`,
      displayName: `${pick(FIRST)} ${pick(SECOND)} ${index % 97}`,
      profilePublic: chance(0.9),
      createdAt,
      emailVerifiedAt: confirmed ? new Date(createdAt.getTime() + delayMinutes * 60_000) : null,
      offset,
      engagement: Math.exp(between(-1.1, 1.0)),
      skill: between(0.35, 0.92),
      favouriteMode: chance(0.6) ? "NAME" : "SHAPE",
    };
    users.push(user);
    if (confirmed && user.emailVerifiedAt <= new Date()) confirmedUsers.push(user);
  }
}
await insertMany(
  "User",
  ["id", "email", "passwordHash", "displayName", "profilePublic", "createdAt", "updatedAt", "emailVerifiedAt"],
  users.map((u) => [u.id, u.email, "demo-not-a-real-hash", u.displayName, u.profilePublic, u.createdAt, u.createdAt, u.emailVerifiedAt]),
);

// --- activity, rounds and their events ------------------------------------------------------
const activity = [];
const results = [];
const events = [];
const counters = new Map(); // "iso|key" -> count
const bump = (offset, key, n = 1) => {
  if (n <= 0) return;
  const k = `${iso(dayStart(offset))}|${key}`;
  counters.set(k, (counters.get(k) ?? 0) + n);
};
let roundNo = 0;

const LENGTHS = [[5, 35], [10, 40], [15, 15], [20, 10]];
const BASE = { EASY: 10, MEDIUM: 20, HARD: 30 };
function makeRound({ at: when, user, signedIn, nonceId }) {
  const mode = user?.favouriteMode && chance(0.8) ? user.favouriteMode : pick(["NAME", "SHAPE"]);
  const difficulty = weighted([["EASY", 50], ["MEDIUM", 32], ["HARD", 18]]);
  const roundLength = weighted(LENGTHS);
  return { mode, difficulty, roundLength, when, signedIn, roundId: nonceId, user };
}

for (const user of confirmedUsers) {
  for (let offset = user.offset; offset >= 0; offset--) {
    const sinceSignup = user.offset - offset;
    const p = sinceSignup === 0 ? 0.95 : Math.min(0.9, (0.42 * Math.exp(-sinceSignup / 7) + 0.07) * user.engagement);
    if (!chance(p)) continue;
    const date = dayStart(offset);
    if (sinceSignup === 0 && user.emailVerifiedAt && user.emailVerifiedAt < date) continue;
    activity.push([user.id, iso(date)]);
    bump(offset, "login.success");

    const roundsToday = poisson(1.6 * user.engagement) + (sinceSignup === 0 ? 1 : 0);
    for (let r = 0; r < roundsToday; r++) {
      const when = at(date);
      if (when > new Date()) continue;
      const round = makeRound({ at: when, user, signedIn: true, nonceId: `demo_r${roundNo++}` });
      const { mode, difficulty, roundLength } = round;
      // Ended early sometimes (left the tab, or went idle); otherwise finished and saved.
      const endedEarly = chance(0.07);
      const durationMs = Math.round(roundLength * between(4500, 12000));
      events.push([round.roundId, "STARTED", mode, difficulty, roundLength, true, null, null, null, when]);
      if (endedEarly) {
        const answered = Math.floor(rand() * roundLength);
        events.push([round.roundId, "ENDED", mode, difficulty, roundLength, true, chance(0.6) ? "LEFT_TAB" : "INACTIVE", answered, Math.round(durationMs * (answered / roundLength || 0.2)), new Date(when.getTime() + durationMs / 2)]);
        continue;
      }
      const hardness = { EASY: 0.1, MEDIUM: 0, HARD: -0.18 }[difficulty] + (mode === "SHAPE" ? -0.07 : 0);
      const accuracy = Math.max(0.1, Math.min(0.99, user.skill + hardness + between(-0.15, 0.15)));
      const correct = Math.max(0, Math.min(roundLength, Math.round(accuracy * roundLength)));
      const bestStreak = correct === 0 ? 0 : Math.min(correct, 1 + Math.floor(rand() * correct * 0.8));
      const neighborCount = Math.min(roundLength - correct, poisson(0.6));
      const speed = chance(0.45) ? 1.4 : chance(0.5) ? 1.2 : 1.05;
      const streakBonus = bestStreak >= 3 ? ((bestStreak - 2) * (bestStreak + 8)) / 2 : 0;
      const score = Math.round(correct * BASE[difficulty] * speed + streakBonus + neighborCount);
      results.push([`demo_g${results.length}`, user.id, mode, difficulty, roundLength, score, correct, when, bestStreak, neighborCount, 2, durationMs, round.roundId]);
      events.push([round.roundId, "FINISHED", mode, difficulty, roundLength, true, null, roundLength, durationMs, new Date(when.getTime() + durationMs)]);
      bump(offset, "round.saved");
    }
  }
}

// Guests: more of them than signed-in players, and they finish less often.
for (let offset = DAYS - 1; offset >= 0; offset--) {
  const age = DAYS - 1 - offset;
  const trend = 2.5 + age / 14;
  const launchSpike = age >= 88 && age <= 93 ? 6 : 1;
  const weekend = [0, 6].includes(dayStart(offset).getUTCDay()) ? 1.35 : 1;
  const guestRounds = poisson(trend * launchSpike * weekend);
  for (let g = 0; g < guestRounds; g++) {
    const when = at(dayStart(offset));
    if (when > new Date()) continue;
    const round = makeRound({ at: when, user: null, signedIn: false, nonceId: `demo_r${roundNo++}` });
    const { mode, difficulty, roundLength } = round;
    const durationMs = Math.round(roundLength * between(4500, 13000));
    events.push([round.roundId, "STARTED", mode, difficulty, roundLength, false, null, null, null, when]);
    const outcome = weighted([["finish", 60], ["left_tab", 17], ["inactive", 11], ["abandon", 12]]);
    if (outcome === "finish") {
      events.push([round.roundId, "FINISHED", mode, difficulty, roundLength, false, null, roundLength, durationMs, new Date(when.getTime() + durationMs)]);
    } else if (outcome !== "abandon") {
      const answered = Math.floor(rand() * roundLength);
      events.push([round.roundId, "ENDED", mode, difficulty, roundLength, false, outcome === "left_tab" ? "LEFT_TAB" : "INACTIVE", answered, Math.round(durationMs * (answered / roundLength || 0.2)), new Date(when.getTime() + durationMs / 2)]);
    }
  }
}

await insertMany("UserActivityDay", ["userId", "day"], activity, { day: "date" });
await insertMany(
  "GameResult",
  ["id", "userId", "mode", "difficulty", "roundLength", "score", "correct", "createdAt", "bestStreak", "neighborCount", "scoringVersion", "totalTimeMs", "roundNonce"],
  results,
  { mode: '"GameMode"', difficulty: '"Difficulty"' },
);
await insertMany(
  "RoundEvent",
  ["roundId", "kind", "mode", "difficulty", "roundLength", "signedIn", "endReason", "answered", "durationMs", "createdAt", "id"],
  events.map((e, i) => [...e, `demo_e${i}`]),
  { kind: '"RoundEventKind"', mode: '"GameMode"', difficulty: '"Difficulty"', endReason: '"RoundEndReason"' },
);

// --- counters: signups, logins, emails, abuse signals, traffic -------------------------------
const startedPerDay = new Map();
for (const e of events) if (e[1] === "STARTED") startedPerDay.set(iso(new Date(e[9])), (startedPerDay.get(iso(new Date(e[9]))) ?? 0) + 1);
for (const u of users) {
  bump(u.offset, "signup.created");
  bump(u.offset, "email.sent.verify");
  if (u.emailVerifiedAt) bump(Math.max(0, Math.round((startOfToday - new Date(iso(u.emailVerifiedAt))) / 86_400_000)), "verify.success");
}
for (let offset = DAYS - 1; offset >= 0; offset--) {
  const date = dayStart(offset);
  const signups = counters.get(`${iso(date)}|signup.created`) ?? 0;
  const started = startedPerDay.get(iso(date)) ?? 0;
  const logins = counters.get(`${iso(date)}|login.success`) ?? 0;

  bump(offset, "signup.refused.disposable", poisson(signups * 0.07));
  bump(offset, "signup.refused.nomx", poisson(signups * 0.05));
  bump(offset, "signup.refused.exists", poisson(signups * 0.04));
  bump(offset, "signup.resumed", poisson(signups * 0.06));
  bump(offset, "signup.rate_limited", chance(0.04) ? 1 + poisson(1) : 0);
  bump(offset, "signup.email_failed", chance(0.03) ? 1 : 0);
  bump(offset, "verify.resend_requested", poisson(signups * 0.18));
  bump(offset, "email.sent.verify", poisson(signups * 0.18));
  bump(offset, "reset.requested", poisson(logins * 0.03));
  bump(offset, "email.sent.reset", poisson(logins * 0.025));
  bump(offset, "reset.success", poisson(logins * 0.02));
  bump(offset, "login.failed", poisson(logins * 0.14));
  bump(offset, "login.locked", chance(0.1) ? 1 + poisson(1) : 0);
  bump(offset, "login.unconfirmed", poisson(signups * 0.09));
  bump(offset, "login.auto", poisson(signups * 0.5));
  bump(offset, "email.failed", chance(0.04) ? 1 : 0);
  bump(offset, "email.budget_blocked", offset < 3 && chance(0.2) ? 1 : 0);
  bump(offset, "round.rejected.implausible", chance(0.12) ? 1 : 0);
  bump(offset, "round.rejected.token", chance(0.05) ? 1 : 0);
  bump(offset, "round.replayed", chance(0.04) ? 1 : 0);
  bump(offset, "round.start_limited", chance(0.02) ? 1 : 0);
  bump(offset, "account.password_changed", poisson(logins * 0.01));
  bump(offset, "account.stats_reset", chance(0.03) ? 1 : 0);
  bump(offset, "account.deleted", chance(0.05) ? 1 : 0);

  // Traffic: roughly two and a half visitors for every round started, each viewing a handful of pages.
  const visitors = Math.max(started ? 2 : 0, Math.round(started * between(1.6, 2.6)) + poisson(2));
  bump(offset, "visitors", visitors);
  const pageviews = Math.round(visitors * between(3.2, 5.0));
  bump(offset, "pageviews", pageviews);
  bump(offset, "pageviews.signed_in", Math.round(pageviews * 0.22));
  const split = (total, entries, prefix) => {
    let left = total;
    entries.forEach(([label, share], i) => {
      const n = i === entries.length - 1 ? left : Math.round(total * share);
      bump(offset, `${prefix}${label}`, Math.max(0, Math.min(left, n)));
      left -= Math.max(0, Math.min(left, n));
    });
  };
  split(visitors, [["mobile", 0.62], ["desktop", 0.3], ["tablet", 0.08]], "visitors.device:");
  split(visitors, [["chrome", 0.5], ["safari", 0.32], ["edge", 0.07], ["firefox", 0.06], ["samsung", 0.03], ["other", 0.02]], "visitors.browser:");
  split(visitors, [["direct", 0.46], ["google", 0.2], ["reddit", 0.1], ["x", 0.07], ["discord", 0.05], ["artembrandt.ca", 0.04], ["github", 0.03], ["other", 0.05]], "visitors.source:");
  split(pageviews, [["/", 0.2], ["/setup", 0.27], ["/play", 0.22], ["/leaderboard", 0.1], ["/about", 0.06], ["/login", 0.05], ["/register", 0.04], ["/profile", 0.03], ["/players/:id", 0.015], ["/privacy", 0.005], ["/terms", 0.003], ["other", 0.007]], "pageviews.page:");
}
await insertMany(
  "DailyCounter",
  ["day", "key", "count"],
  [...counters.entries()].map(([k, count]) => {
    const [day, key] = k.split("|");
    return [day, key, count];
  }),
  { day: "date" },
);

// --- feedback and abuse signals -------------------------------------------------------------
const SUBJECTS = [
  ["BUG", "The map zoom button does nothing for Fiji", "Tapped the loupe on Fiji and nothing happened. Chrome on Android."],
  ["BUG", "Round ended when I got a notification", "A message popup switched tabs for a second and my round ended. Annoying!"],
  ["FEEDBACK", "Love the cartography style", "The antique map look is gorgeous. Could there be a daily challenge?"],
  ["FEEDBACK", "Add capitals mode", "Would be great to guess capitals as well as countries."],
  ["BUG", "Leaderboard cut off on my phone", "The Correct column is hidden on a small screen."],
  ["FEEDBACK", "More time for typing", "Shape mode feels fast, maybe a slower speed bonus window?"],
  ["BUG", "Confirmation email in spam", "Took a while to find the confirmation email, it was in junk."],
  ["FEEDBACK", "Hard mode is great", "Good job on the tiers, hard is properly hard."],
];
const feedbackRows = [];
for (let i = 0; i < 38; i++) {
  const [kind, subject, description] = pick(SUBJECTS);
  const createdAt = at(dayStart(Math.floor(rand() * DAYS * 0.9)));
  const emailed = chance(0.9);
  feedbackRows.push([`demo_f${i}`, kind, subject, description, chance(0.45) ? pick(users).id : null, createdAt, Math.floor(rand() * 2), emailed ? createdAt : null, !emailed ? "Daily email budget reached; not emailed." : null]);
}
await insertMany(
  "Feedback",
  ["id", "kind", "subject", "description", "userId", "createdAt", "attachmentCount", "emailedAt", "emailError"],
  feedbackRows,
  { kind: '"FeedbackKind"' },
);

const hex = () => Math.floor(rand() * 2 ** 32).toString(16).padStart(8, "0");
const hits = [];
const within24h = () => new Date(Date.now() - Math.floor(rand() * 86_400_000));
for (let i = 0; i < 74; i++) hits.push([`demo_h${hits.length}`, "email-budget", "all", within24h()]);
for (let i = 0; i < 9; i++) hits.push([`demo_h${hits.length}`, "login-fail:email", hex(), within24h()]);
for (let i = 0; i < 6; i++) hits.push([`demo_h${hits.length}`, "login-fail:ip", hex(), within24h()]);
for (let i = 0; i < 4; i++) hits.push([`demo_h${hits.length}`, "signup:ip", hex(), within24h()]);
for (let i = 0; i < 11; i++) hits.push([`demo_h${hits.length}`, "round-start:ip", hex(), within24h()]);
for (let i = 0; i < 3; i++) hits.push([`demo_h${hits.length}`, "email-send:verify:address", hex(), within24h()]);
await insertMany("RateLimitHit", ["id", "bucket", "key", "createdAt"], hits);

const [summary] = (
  await db.query(`SELECT
    (SELECT count(*) FROM "User")::int AS users,
    (SELECT count(*) FROM "UserActivityDay")::int AS activity_days,
    (SELECT count(*) FROM "GameResult")::int AS saved_rounds,
    (SELECT count(*) FROM "RoundEvent")::int AS round_events,
    (SELECT count(*) FROM "DailyCounter")::int AS counter_rows,
    (SELECT count(*) FROM "Feedback")::int AS feedback`)
).rows;
await db.end();
console.log(`seeded ${dbName}:`, summary);
console.log("now run: npm run admin:demo");
