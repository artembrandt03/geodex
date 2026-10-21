/**
 * Every number on the dashboard comes from here, one function per panel. Each takes `q`
 * (run a read-only query, get rows back) and the page's options, and returns plain data
 * for the charts. Days are UTC calendar days throughout, matching how the app records
 * them; only the hour-of-day heat map shifts to the viewer's time zone.
 *
 * Only aggregates are returned. The one place a person appears is "most active players",
 * which shows display names that are already public on the leaderboard; no email address is
 * ever selected (the read-only database user isn't even allowed to).
 */

/** Today's date in UTC, and the current moment as a UTC timestamp (the app's columns are UTC). */
const TODAY = `(now() AT TIME ZONE 'UTC')::date`;
const NOW_UTC = `(now() AT TIME ZONE 'UTC')`;

/** A table of the last $1 days, one row each, oldest first. */
const DAYS = `generate_series(${TODAY} - ($1::int - 1), ${TODAY}, interval '1 day')::date`;

/** The window start for "in the last $1 days". */
const IN_RANGE = (column) => `${column}::date > ${TODAY} - $1::int`;

const num = (value) => (value === null || value === undefined ? 0 : Number(value));
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

/** ---------------------------------------------------------------- overview */
export async function overview(q) {
  const [users] = await q(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE "emailVerifiedAt" IS NOT NULL)::int AS confirmed,
      count(*) FILTER (WHERE "emailVerifiedAt" IS NULL)::int AS unconfirmed,
      count(*) FILTER (WHERE "emailVerifiedAt" IS NULL AND "createdAt" < ${NOW_UTC} - interval '7 days')::int AS unconfirmed_stale,
      count(*) FILTER (WHERE "createdAt"::date = ${TODAY})::int AS today,
      count(*) FILTER (WHERE "createdAt"::date > ${TODAY} - 7)::int AS last7,
      count(*) FILTER (WHERE "createdAt"::date > ${TODAY} - 30)::int AS last30,
      count(*) FILTER (WHERE "profilePublic")::int AS public_profiles
    FROM "User"`);

  const [active] = await q(`
    SELECT
      count(DISTINCT "userId") FILTER (WHERE day = ${TODAY})::int AS dau,
      count(DISTINCT "userId") FILTER (WHERE day > ${TODAY} - 7)::int AS wau,
      count(DISTINCT "userId")::int AS mau
    FROM "UserActivityDay" WHERE day > ${TODAY} - 30`);

  const [rounds] = await q(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE "createdAt"::date = ${TODAY})::int AS today,
      count(*) FILTER (WHERE "createdAt"::date > ${TODAY} - 7)::int AS last7
    FROM "GameResult"`);

  const [events] = await q(`
    SELECT
      count(*) FILTER (WHERE kind = 'STARTED')::int AS started,
      count(*) FILTER (WHERE kind = 'FINISHED')::int AS finished,
      count(*) FILTER (WHERE kind = 'ENDED')::int AS ended
    FROM "RoundEvent" WHERE "createdAt"::date = ${TODAY}`);

  const todayCounters = await q(
    `SELECT key, count::int AS count FROM "DailyCounter" WHERE day = ${TODAY} AND key IN ('visitors', 'pageviews', 'signup.created')`,
  );
  const counter = (key) => num(todayCounters.find((row) => row.key === key)?.count);

  const [feedback] = await q(`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE "createdAt"::date > ${TODAY} - 7)::int AS last7 FROM "Feedback"`);

  const [since] = await q(`
    SELECT
      (SELECT min(day)::text FROM "UserActivityDay") AS activity,
      (SELECT min("createdAt")::date::text FROM "RoundEvent") AS rounds,
      (SELECT min(day)::text FROM "DailyCounter") AS counters`);

  return {
    users: { ...users, confirmationRate: pct(users.confirmed, users.total) },
    active: { ...active, stickiness: pct(active.dau, active.mau) },
    rounds,
    events: { ...events, completionRate: pct(events.finished, events.started) },
    today: { visitors: counter("visitors"), pageviews: counter("pageviews"), signups: counter("signup.created") },
    feedback,
    trackingSince: since,
  };
}

/** ------------------------------------------------------------------ growth */
export async function growth(q, { days }) {
  const rows = await q(
    `WITH d AS (SELECT ${DAYS} AS day)
     SELECT d.day::text AS day,
       (SELECT count(*) FROM "User" u WHERE u."createdAt"::date = d.day)::int AS signups,
       (SELECT count(*) FROM "User" u WHERE u."emailVerifiedAt"::date = d.day)::int AS confirmations,
       (SELECT count(*) FROM "User" u WHERE u."createdAt"::date <= d.day)::int AS total
     FROM d ORDER BY d.day`,
    [days],
  );
  const weekly = await q(`
    SELECT date_trunc('week', "createdAt")::date::text AS week,
           count(*)::int AS signups,
           count(*) FILTER (WHERE "emailVerifiedAt" IS NOT NULL)::int AS confirmed
    FROM "User"
    WHERE "createdAt" >= date_trunc('week', ${NOW_UTC}) - interval '12 weeks'
    GROUP BY 1 ORDER BY 1`);
  return {
    daily: rows,
    weekly: weekly.map((w) => ({ ...w, confirmationRate: pct(w.confirmed, w.signups) })),
  };
}

/** ---------------------------------------------------------------- activity */
export async function activity(q, { days }) {
  const rows = await q(
    `WITH d AS (SELECT ${DAYS} AS day)
     SELECT d.day::text AS day,
       (SELECT count(*) FROM "UserActivityDay" a WHERE a.day = d.day)::int AS dau,
       (SELECT count(*) FROM "UserActivityDay" a JOIN "User" u ON u.id = a."userId"
          WHERE a.day = d.day AND u."createdAt"::date = d.day)::int AS new_users,
       (SELECT count(DISTINCT a."userId") FROM "UserActivityDay" a WHERE a.day BETWEEN d.day - 6 AND d.day)::int AS wau,
       (SELECT count(DISTINCT a."userId") FROM "UserActivityDay" a WHERE a.day BETWEEN d.day - 29 AND d.day)::int AS mau
     FROM d ORDER BY d.day`,
    [days],
  );
  const daily = rows.map((r) => ({
    ...r,
    returning: Math.max(0, r.dau - r.new_users),
    stickiness: pct(r.dau, r.mau),
  }));
  const [recency] = await q(`
    WITH last AS (
      SELECT u.id, max(a.day) AS last_day
      FROM "User" u LEFT JOIN "UserActivityDay" a ON a."userId" = u.id
      GROUP BY u.id
    )
    SELECT
      count(*) FILTER (WHERE last_day = ${TODAY})::int AS today,
      count(*) FILTER (WHERE last_day < ${TODAY} AND last_day > ${TODAY} - 7)::int AS this_week,
      count(*) FILTER (WHERE last_day <= ${TODAY} - 7 AND last_day > ${TODAY} - 30)::int AS this_month,
      count(*) FILTER (WHERE last_day <= ${TODAY} - 30)::int AS older,
      count(*) FILTER (WHERE last_day IS NULL)::int AS never
    FROM last`);
  return { daily, recency };
}

/** ------------------------------------------------------------------ rounds */
export async function rounds(q, { days, tz }) {
  const daily = await q(
    `WITH d AS (SELECT ${DAYS} AS day)
     SELECT d.day::text AS day,
       (SELECT count(*) FROM "GameResult" g WHERE g."createdAt"::date = d.day AND g.mode = 'NAME')::int AS saved_name,
       (SELECT count(*) FROM "GameResult" g WHERE g."createdAt"::date = d.day AND g.mode = 'SHAPE')::int AS saved_shape,
       (SELECT count(*) FROM "RoundEvent" e WHERE e."createdAt"::date = d.day AND e.kind = 'STARTED')::int AS started,
       (SELECT count(*) FROM "RoundEvent" e WHERE e."createdAt"::date = d.day AND e.kind = 'FINISHED')::int AS finished,
       (SELECT count(*) FROM "RoundEvent" e WHERE e."createdAt"::date = d.day AND e.kind = 'ENDED' AND e."endReason" = 'LEFT_TAB')::int AS left_tab,
       (SELECT count(*) FROM "RoundEvent" e WHERE e."createdAt"::date = d.day AND e.kind = 'ENDED' AND e."endReason" = 'INACTIVE')::int AS inactive,
       (SELECT count(*) FROM "RoundEvent" e WHERE e."createdAt"::date = d.day AND e.kind = 'STARTED' AND NOT e."signedIn")::int AS guest_started,
       (SELECT count(*) FROM "RoundEvent" e WHERE e."createdAt"::date = d.day AND e.kind = 'STARTED' AND e."signedIn")::int AS signed_in_started
     FROM d ORDER BY d.day`,
    [days],
  );

  const [funnel] = await q(
    `SELECT
       count(*) FILTER (WHERE kind = 'STARTED')::int AS started,
       count(*) FILTER (WHERE kind = 'FINISHED')::int AS finished,
       count(*) FILTER (WHERE kind = 'ENDED' AND "endReason" = 'LEFT_TAB')::int AS left_tab,
       count(*) FILTER (WHERE kind = 'ENDED' AND "endReason" = 'INACTIVE')::int AS inactive,
       count(*) FILTER (WHERE kind = 'STARTED' AND NOT "signedIn")::int AS guest_started,
       count(*) FILTER (WHERE kind = 'STARTED' AND "signedIn")::int AS signed_in_started
     FROM "RoundEvent" WHERE ${IN_RANGE(`"createdAt"`)}`,
    [days],
  );
  funnel.abandoned = Math.max(0, funnel.started - funnel.finished - funnel.left_tab - funnel.inactive);
  funnel.completionRate = pct(funnel.finished, funnel.started);

  const byConfig = await q(
    `SELECT mode, difficulty, "roundLength" AS length,
       count(*) FILTER (WHERE kind = 'STARTED')::int AS started,
       count(*) FILTER (WHERE kind = 'FINISHED')::int AS finished,
       count(*) FILTER (WHERE kind = 'ENDED')::int AS ended
     FROM "RoundEvent" WHERE ${IN_RANGE(`"createdAt"`)}
     GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`,
    [days],
  );
  const configs = byConfig.map((c) => ({ ...c, completionRate: pct(c.finished, c.started) }));

  const mix = {
    mode: await q(`SELECT mode::text AS label, count(*)::int AS n FROM "GameResult" WHERE ${IN_RANGE(`"createdAt"`)} GROUP BY 1 ORDER BY 1`, [days]),
    difficulty: await q(`SELECT difficulty::text AS label, count(*)::int AS n FROM "GameResult" WHERE ${IN_RANGE(`"createdAt"`)} GROUP BY 1 ORDER BY 1`, [days]),
    length: await q(`SELECT "roundLength"::text AS label, count(*)::int AS n FROM "GameResult" WHERE ${IN_RANGE(`"createdAt"`)} GROUP BY 1 ORDER BY min("roundLength")`, [days]),
  };

  const duration = await q(
    `SELECT "roundLength" AS length,
       count(*)::int AS n,
       round(avg("durationMs") / 1000.0, 1)::float AS avg_seconds,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs") / 1000.0)::numeric, 1)::float AS median_seconds
     FROM "RoundEvent" WHERE kind = 'FINISHED' AND "durationMs" IS NOT NULL AND ${IN_RANGE(`"createdAt"`)}
     GROUP BY 1 ORDER BY 1`,
    [days],
  );

  const endedAt = await q(
    `SELECT answered, count(*)::int AS n FROM "RoundEvent"
     WHERE kind = 'ENDED' AND answered IS NOT NULL AND ${IN_RANGE(`"createdAt"`)} GROUP BY 1 ORDER BY 1`,
    [days],
  );

  // Rounds started by weekday and hour in the viewer's own time zone (tz is minutes from UTC).
  const heat = await q(
    `SELECT extract(dow FROM ("createdAt" + ($2::int * interval '1 minute')))::int AS dow,
            extract(hour FROM ("createdAt" + ($2::int * interval '1 minute')))::int AS hour,
            count(*)::int AS n
     FROM "RoundEvent" WHERE kind = 'STARTED' AND ${IN_RANGE(`"createdAt"`)} GROUP BY 1, 2`,
    [days, tz],
  );
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const { dow, hour, n } of heat) heatmap[dow][hour] = n;

  return { daily, funnel, configs, mix, duration, endedAt, heatmap };
}

/** ---------------------------------------------------------------- gameplay */
export async function gameplay(q, { days }) {
  const [version] = await q(`SELECT coalesce(max("scoringVersion"), 0)::int AS version FROM "GameResult"`);
  const current = `"scoringVersion" = ${version.version}`;

  const byConfig = await q(
    `SELECT mode::text AS mode, difficulty::text AS difficulty, "roundLength" AS length,
       count(*)::int AS rounds,
       round(avg(score)::numeric, 1)::float AS avg_score,
       max(score)::int AS best_score,
       round((avg(correct::float / "roundLength") * 100)::numeric, 1)::float AS avg_accuracy,
       round((avg("totalTimeMs"::float / "roundLength") / 1000)::numeric, 2)::float AS avg_seconds_per_question,
       round(avg("bestStreak")::numeric, 1)::float AS avg_best_streak,
       round(avg("neighborCount")::numeric, 2)::float AS avg_neighbor_guesses,
       count(*) FILTER (WHERE correct = "roundLength")::int AS perfect_rounds
     FROM "GameResult" WHERE ${current} AND ${IN_RANGE(`"createdAt"`)}
     GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`,
    [days],
  );

  const accuracy = await q(
    `SELECT width_bucket(correct::float / "roundLength", 0, 1.0000001, 10)::int AS bucket, count(*)::int AS n
     FROM "GameResult" WHERE ${current} AND ${IN_RANGE(`"createdAt"`)} GROUP BY 1 ORDER BY 1`,
    [days],
  );
  const accuracyBuckets = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}-${i === 9 ? 100 : i * 10 + 9}%`,
    n: num(accuracy.find((a) => a.bucket === i + 1)?.n),
  }));

  const [totals] = await q(
    `SELECT count(*)::int AS rounds,
       count(DISTINCT "userId")::int AS players,
       round((count(*)::numeric / nullif(count(DISTINCT "userId"), 0)), 1)::float AS rounds_per_player,
       count(*) FILTER (WHERE correct = "roundLength")::int AS perfect_rounds,
       round((avg(correct::float / "roundLength") * 100)::numeric, 1)::float AS avg_accuracy
     FROM "GameResult" WHERE ${current} AND ${IN_RANGE(`"createdAt"`)}`,
    [days],
  );

  const topPlayers = await q(
    `SELECT u."displayName" AS name,
       count(*)::int AS rounds,
       max(g.score)::int AS best_score,
       sum(g.score)::int AS total_score
     FROM "GameResult" g JOIN "User" u ON u.id = g."userId"
     WHERE g.${current} AND ${IN_RANGE(`g."createdAt"`)}
     GROUP BY u.id, u."displayName" ORDER BY rounds DESC, total_score DESC LIMIT 10`,
    [days],
  );

  return { scoringVersion: version.version, totals, byConfig, accuracyBuckets, topPlayers };
}

/** --------------------------------------------------------------- retention */
export async function retention(q) {
  const classic = [];
  for (const n of [1, 7, 30]) {
    const [row] = await q(
      `SELECT
         count(*)::int AS eligible,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM "UserActivityDay" a WHERE a."userId" = u.id AND a.day = u."createdAt"::date + $1::int
         ))::int AS returned
       FROM "User" u WHERE u."createdAt"::date <= ${TODAY} - $1::int`,
      [n],
    );
    classic.push({ day: n, eligible: row.eligible, returned: row.returned, rate: pct(row.returned, row.eligible) });
  }

  const cells = await q(`
    WITH cohorts AS (
      SELECT id, date_trunc('week', "createdAt")::date AS cw FROM "User"
      WHERE "createdAt" >= date_trunc('week', ${NOW_UTC}) - interval '8 weeks'
    ),
    act AS (SELECT DISTINCT "userId", date_trunc('week', day)::date AS aw FROM "UserActivityDay")
    SELECT c.cw::text AS cohort, count(DISTINCT c.id)::int AS size,
           ((act.aw - c.cw) / 7)::int AS k, count(DISTINCT act."userId")::int AS active
    FROM cohorts c LEFT JOIN act ON act."userId" = c.id AND act.aw >= c.cw
    GROUP BY 1, 3 ORDER BY 1, 3`);

  const byCohort = new Map();
  for (const { cohort, size, k, active } of cells) {
    const entry = byCohort.get(cohort) ?? { cohort, size: 0, weeks: [] };
    entry.size = Math.max(entry.size, size);
    if (k !== null) entry.weeks[k] = active;
    byCohort.set(cohort, entry);
  }
  const cohorts = [...byCohort.values()].map((c) => ({
    cohort: c.cohort,
    size: c.size,
    // Share of the cohort active k weeks after the week they signed up, for the weeks that have happened.
    retention: Array.from({ length: 9 }, (_, k) => {
      const weekStart = new Date(`${c.cohort}T00:00:00Z`);
      weekStart.setUTCDate(weekStart.getUTCDate() + k * 7);
      return weekStart > new Date() ? null : pct(num(c.weeks[k]), c.size);
    }),
  }));

  return { classic, cohorts };
}

/** ----------------------------------------------------------------- traffic */
const breakdown = (q, prefix, days) =>
  q(
    `SELECT substring(key from position(':' in key) + 1) AS label, sum(count)::int AS n
     FROM "DailyCounter" WHERE key LIKE $2 AND ${IN_RANGE("day")} GROUP BY 1 ORDER BY 2 DESC`,
    [days, `${prefix}%`],
  );

export async function traffic(q, { days }) {
  const daily = await q(
    `WITH d AS (SELECT ${DAYS} AS day)
     SELECT d.day::text AS day,
       coalesce(sum(c.count) FILTER (WHERE c.key = 'visitors'), 0)::int AS visitors,
       coalesce(sum(c.count) FILTER (WHERE c.key = 'pageviews'), 0)::int AS pageviews,
       coalesce(sum(c.count) FILTER (WHERE c.key = 'pageviews.signed_in'), 0)::int AS signed_in_pageviews
     FROM d LEFT JOIN "DailyCounter" c ON c.day = d.day AND c.key IN ('visitors', 'pageviews', 'pageviews.signed_in')
     GROUP BY d.day ORDER BY d.day`,
    [days],
  );
  const [funnelRaw] = await q(
    `SELECT
       coalesce((SELECT sum(count) FROM "DailyCounter" WHERE key = 'visitors' AND ${IN_RANGE("day")}), 0)::int AS visitors,
       coalesce((SELECT sum(count) FROM "DailyCounter" WHERE key = 'pageviews.page:/setup' AND ${IN_RANGE("day")}), 0)::int AS setup_views,
       (SELECT count(*) FROM "RoundEvent" WHERE kind = 'STARTED' AND ${IN_RANGE(`"createdAt"`)})::int AS rounds_started,
       coalesce((SELECT sum(count) FROM "DailyCounter" WHERE key = 'signup.created' AND ${IN_RANGE("day")}), 0)::int AS signups`,
    [days],
  );
  return {
    daily,
    funnel: funnelRaw,
    pages: await breakdown(q, "pageviews.page:", days),
    devices: await breakdown(q, "visitors.device:", days),
    browsers: await breakdown(q, "visitors.browser:", days),
    sources: await breakdown(q, "visitors.source:", days),
  };
}

/** ---------------------------------------------------------------- accounts */
export async function accounts(q) {
  const [health] = await q(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE "emailVerifiedAt" IS NOT NULL)::int AS confirmed,
      round((avg(extract(epoch FROM ("emailVerifiedAt" - "createdAt")) / 60.0))::numeric, 1)::float AS avg_minutes_to_confirm,
      round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM ("emailVerifiedAt" - "createdAt")) / 60.0))::numeric, 1)::float AS median_minutes_to_confirm,
      count(*) FILTER (WHERE "profilePublic")::int AS public_profiles
    FROM "User"`);
  const [play] = await q(`
    SELECT
      (SELECT count(DISTINCT "userId") FROM "GameResult")::int AS with_rounds,
      (SELECT count(*) FROM "User" WHERE "emailVerifiedAt" IS NOT NULL)::int AS confirmed_accounts`);
  const ages = await q(`
    SELECT
      count(*) FILTER (WHERE "createdAt" > ${NOW_UTC} - interval '1 day')::int AS under_1d,
      count(*) FILTER (WHERE "createdAt" <= ${NOW_UTC} - interval '1 day' AND "createdAt" > ${NOW_UTC} - interval '7 days')::int AS d1_to_7,
      count(*) FILTER (WHERE "createdAt" <= ${NOW_UTC} - interval '7 days')::int AS over_7d
    FROM "User" WHERE "emailVerifiedAt" IS NULL`);
  return {
    health: { ...health, confirmationRate: pct(health.confirmed, health.total), publicRate: pct(health.public_profiles, health.total) },
    playing: { ...play, rate: pct(play.with_rounds, play.confirmed_accounts) },
    unconfirmedAges: ages[0],
  };
}

/** ---------------------------------------------------------------- feedback */
export async function feedback(q, { days }) {
  const daily = await q(
    `WITH d AS (SELECT ${DAYS} AS day)
     SELECT d.day::text AS day,
       (SELECT count(*) FROM "Feedback" f WHERE f."createdAt"::date = d.day AND f.kind = 'BUG')::int AS bugs,
       (SELECT count(*) FROM "Feedback" f WHERE f."createdAt"::date = d.day AND f.kind = 'FEEDBACK')::int AS ideas
     FROM d ORDER BY d.day`,
    [days],
  );
  const [totals] = await q(`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE kind = 'BUG')::int AS bugs,
      count(*) FILTER (WHERE kind = 'FEEDBACK')::int AS ideas,
      count(*) FILTER (WHERE "emailedAt" IS NOT NULL)::int AS emailed,
      count(*) FILTER (WHERE "emailError" IS NOT NULL)::int AS email_failed,
      count(*) FILTER (WHERE "userId" IS NOT NULL)::int AS from_players
    FROM "Feedback"`);
  const recent = await q(`
    SELECT "createdAt"::text AS at, kind::text AS kind, subject, left(description, 220) AS excerpt,
           ("userId" IS NOT NULL) AS signed_in, "attachmentCount" AS attachments,
           ("emailedAt" IS NOT NULL) AS emailed, ("emailError" IS NOT NULL) AS email_failed
    FROM "Feedback" ORDER BY "createdAt" DESC LIMIT 15`);
  return { daily, totals, recent };
}

/** -------------------------------------------------------------- operations */
export async function operations(q, { days, config }) {
  const counters = await q(
    `SELECT day::text AS day, key, count::int AS count FROM "DailyCounter"
     WHERE ${IN_RANGE("day")} AND key NOT LIKE 'pageviews%' AND key NOT LIKE 'visitors%'
     ORDER BY day`,
    [days],
  );
  const [budget] = await q(
    `SELECT count(*)::int AS used FROM "RateLimitHit" WHERE bucket = 'email-budget' AND "createdAt" > ${NOW_UTC} - interval '24 hours'`,
  );
  const rateLimits = await q(
    `SELECT bucket, count(*)::int AS n FROM "RateLimitHit"
     WHERE "createdAt" > ${NOW_UTC} - interval '24 hours' GROUP BY 1 ORDER BY 2 DESC`,
  );
  return {
    counters,
    emailBudget: { used: budget.used, limit: config.emailDailyLimit, usedRate: pct(budget.used, config.emailDailyLimit) },
    rateLimits,
  };
}

/** ---------------------------------------------------------------- database */
export async function database(q) {
  const [info] = await q(`
    SELECT current_database() AS name, current_user AS "user", version() AS version,
           pg_database_size(current_database())::bigint AS bytes,
           current_setting('transaction_read_only') AS read_only`);
  const tables = await q(`
    SELECT relname AS name, n_live_tup::bigint AS rows, pg_total_relation_size(relid)::bigint AS bytes
    FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC`);
  return {
    name: info.name,
    user: info.user,
    version: info.version.split(" on ")[0],
    bytes: Number(info.bytes),
    readOnly: info.read_only === "on",
    tables: tables.map((t) => ({ name: t.name, rows: Number(t.rows), bytes: Number(t.bytes) })),
  };
}

export const PANELS = { overview, growth, activity, rounds, gameplay, retention, traffic, accounts, feedback, operations, database };
