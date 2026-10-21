# Geodex admin dashboard

A private, read-only monitoring dashboard for the person running Geodex. It shows how many accounts
exist, who is active, rounds played per day, retention, traffic, abuse signals, feedback and database
size. It shows **aggregates only**: no email addresses, passwords or one-time tokens are ever queried.

## How it stays private

- **It is not part of the website.** Nothing in `admin/` is built, imported or deployed by the app
  or by Netlify. It is a small Node server you start on your own computer.
- **It only listens on `127.0.0.1`**, so other machines on your network can't reach it. It also
  refuses requests whose `Host` or `Origin` isn't localhost (this blocks DNS-rebinding attacks from
  a web page you happen to visit), only answers `GET`, and sends strict security headers.
- **It can't change anything.** Every query runs inside a read-only transaction with a statement
  timeout, and for production you give it a Postgres login that physically lacks write access and
  can't see the sensitive columns (see below).

## Run it

```bash
npm run admin
```

Open http://localhost:4000. By default it reads your local development database
(`localhost:5442/geodex`). Pick a range (7 to 365 days), flip on auto-refresh, and use the tabs:
Overview, Growth, Activity, Rounds, Gameplay, Retention, Traffic, Accounts, Feedback, Operations
and Database.

To see it full of data before you have real players, or to demo it:

```bash
npm run admin:seed-demo   # creates and fills the geodex_demo database with 150 days of invented activity
npm run admin:demo        # starts the dashboard against it
```

The seeder refuses to touch any database whose name doesn't end in `_demo`.

## Pointing it at production later

1. In the production database's SQL editor (Neon: the SQL editor), run
   `admin/sql/create-readonly-role.sql` after changing the placeholder password. It creates the
   login `geodex_admin_ro`, which can read only the columns the dashboard uses.
2. Copy `admin/.env.example` to `admin/.env` and set `ADMIN_DATABASE_URL` to that login's
   connection string.
3. `npm run admin` as before. The top of the page shows which database it is reading.

Keep `admin/.env` out of git (it already is) and never paste the app's own read/write connection
string there.

## Where the numbers come from

Most come from the main tables (`User`, `GameResult`, `Feedback`). Usage statistics come from
tables the app fills as people play, all anonymous or aggregate (see the privacy policy):

| Table | What it holds |
| --- | --- |
| `UserActivityDay` | one row per account per day it did something (drives DAU/WAU/MAU, retention) |
| `RoundEvent` | one anonymous row per round start, finish or early end (no account, IP or browser) |
| `DailyCounter` | named daily totals: page views, visitors by device/browser/source, signups, logins, emails, refusals |
| `DailyVisitor` | daily rotating hashes used to count a visitor once a day; deleted within days; not readable by the dashboard |

Statistics only go back to when the tracking was added; accounts and saved rounds go back to the start.
Days are UTC. The hour-of-day heat map is shifted to your browser's time zone.

## Files

- `server.mjs`, `lib/server.mjs`: the HTTP server. `lib/security.mjs`: host/origin checks and headers.
- `lib/db.mjs`: the read-only database layer. `lib/queries.mjs`: one function per tab.
- `public/`: the page (plain HTML, CSS and JavaScript; Chart.js is served from `node_modules`, so there is no build step).
- `scripts/seed-demo.mjs`, `sql/create-readonly-role.sql`: demo data and the production login.
