# Geodex

A geography guessing game built on an interactive world map. Guess countries by name or by shape, race the clock across different difficulty tiers, and climb the leaderboard.

This project is a "vibe-coded" experiment — built end-to-end with [Claude Code](https://claude.com/claude-code) to explore what an AI pair-programmer can do on a real, full-stack app.

## Features (MVP)

- **Guess by name** — a country name is shown, click it on the map.
- **Guess by shape** — a country is highlighted on the map, type/select its name.
- **Difficulty tiers** — rounds of 5, 10, 15, or 20 countries.
- **Accounts** — register/log in to save scores and appear on the leaderboard.
- **Guest mode** — play without an account (scores aren't saved to the leaderboard).
- **Leaderboards** — per mode and difficulty.

## Tech stack

| Layer      | Choice                                      |
|------------|----------------------------------------------|
| Frontend   | React + TypeScript + Vite (via Next.js)      |
| Framework  | Next.js (App Router) — frontend + API routes |
| Styling    | Tailwind CSS                                 |
| Map        | react-simple-maps (d3-geo, equirectangular projection) + world-atlas TopoJSON |
| Database   | PostgreSQL (Neon or Supabase)                |
| ORM        | Prisma                                       |
| Auth       | Auth.js (NextAuth)                           |
| Hosting    | Netlify                                      |
| Testing    | Vitest                                       |

See [CLAUDE.md](./CLAUDE.md) for detailed decisions, conventions, and project status.

## Branch strategy

```
mvp -> dev -> main
```

- **mvp** — active MVP development happens here.
- **dev** — integration branch; MVP (and later feature branches) merge here.
- **main** — production; deploys from here via Netlify.

Later feature/version branches follow the same pattern: `feature/*` or `vX.Y` branches merge into `dev`, and `dev` merges into `main` for release.

## Testing

```bash
npm test                  # unit tests (Vitest): scoring, matching, rate limits, ...
npm run test:e2e          # end-to-end suite (Playwright): Chromium + WebKit, desktop + phone
npm run test:e2e:chromium # the fast loop
npm run test:e2e:ui       # Playwright's interactive runner
```

The end-to-end suite builds the app and runs it against its own `geodex_test` database
(same Postgres container as development; it refuses to run against any database whose name
doesn't end in `_test`) with a fake mail server, so it never touches dev data or sends real
email. See [CLAUDE.md](./CLAUDE.md) for how it works. Start Postgres first (`docker compose up -d`).

## Admin dashboard

A private, read-only monitoring dashboard for the owner (accounts, daily active players, rounds
per day, retention, traffic, abuse signals, feedback, database size; aggregates only). It lives in
[`admin/`](./admin/README.md), is never deployed, and only listens on `127.0.0.1`.

```bash
npm run admin             # reads your local development database -> http://localhost:4000
npm run admin:seed-demo   # fills a separate geodex_demo database with invented activity
npm run admin:demo        # the same dashboard, pointed at that demo data
```

## Getting started

_Coming soon — project scaffolding in progress._
