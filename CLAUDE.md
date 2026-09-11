# Geodex — Project Notes for Claude

This file is project memory: decisions, conventions, and status that aren't obvious from the code alone. Keep it up to date as the project evolves — update it in the same commit as the change it describes, don't let it drift.

## What this is

A geography guessing game on an interactive world map (cylindrical/equirectangular projection). Solo hobby project, being built almost entirely by Claude Code as an experiment in AI-driven full-stack development. The user (Artem) is directing scope/product decisions; Claude owns implementation.

## Game design (MVP)

Two modes:
1. **Guess by name** — country name shown as a prompt; player clicks the matching country on the map.
2. **Guess by shape** — a country is highlighted on the map; player identifies it by name (typed/selected).

Two independent axes configure a round:
- **Round length**: 5 / 10 / 15 / 20 countries.
- **Difficulty tier**: Easy / Medium / Hard — controls which pool of countries questions are drawn from, by obscurity/prominence (Easy = widely-known countries, Hard = less-known ones, Medium = mixed). Backed by a hand-curated popularity tier in the country seed data.

Accounts:
- Register/login required to appear on the leaderboard.
- Guest play allowed, but guest scores are not persisted to the leaderboard.

Leaderboards: scoped per mode + difficulty + round length.

### Scoring

No hard time limit per question — players can take as long as they want.

- Correct guess in 0–5s: **50 points** (max).
- Correct guess after 5s: linearly decays from 50 toward a floor of **25 points**, never going lower as long as the guess is eventually correct.
- Incorrect guess (or no guess submitted): **0 points**.
- Single attempt per question — no retries.
- Round score = sum of per-question scores.

## Tech stack (decided)

- **Next.js (App Router, TypeScript)** — single app, frontend + API routes. Chosen over separate Vite+Fastify to keep one deployable unit and one language throughout.
- **Tailwind CSS** for styling.
- **react-simple-maps** (wraps d3-geo/TopoJSON) with `geoEquirectangular` projection for the map. Country boundaries from **world-atlas** TopoJSON (Natural Earth data).
- **PostgreSQL** via **Prisma ORM**. Hosted on Neon or Supabase (free tier).
- **Auth.js (NextAuth)** for accounts. Guests are unauthenticated client-side sessions — no backend identity needed for them.
- **Netlify** for hosting (Next.js Runtime plugin handles SSR/API routes).
- **Vitest** for unit tests (scoring logic, country-matching logic first).

## Branch strategy

```
mvp -> dev -> main
```

- `main` — production, deploys via Netlify.
- `dev` — integration branch.
- `mvp` — current active development branch for the MVP. Future work uses similarly named feature/version branches merging into `dev`, then `dev` into `main`.

Claude builds the MVP end-to-end on the `mvp` branch. Commit attribution: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

### Commit conventions

- Small, modular commits — roughly what a developer would write in 15–30 minutes, or one sub-feature / ~100 lines at a time. No giant catch-all commits.
- Conventional commit prefixes: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/` (as scope prefixes in the branch/commit subject, e.g. `feat: add country selection logic`).
- Push to `origin/mvp` regularly as work lands.
- Never commit secrets. `.env*` (except `.env.example`), DB credentials, and auth secrets are git-ignored — verify before every commit that nothing sensitive is staged.

## Status log

Keep this short — a running log of what's done, not a design doc. Prune entries that are no longer relevant once superseded by actual code.

- 2026-09-11: Repo created, stack + branch strategy decided. README and CLAUDE.md added on `main`. `dev` and `mvp` branches created.
- 2026-09-11: Next.js app scaffolded (App Router, TS, Tailwind). Local Postgres via Docker Compose (host port 5442 — 5432 is taken by other local projects). Prisma schema (User/Country/GameResult) + initial migration. Country table seeded from world-atlas TopoJSON with curated Easy/Medium/Hard tiers (195 countries: 59/82/54). Map data copied to `public/data/countries-50m.json`. Pinned prisma/@prisma-client to 6.12.0 (newer versions have unresolvable peer deps or high-severity transitive vulns).
- 2026-09-11: **MVP feature-complete and verified end-to-end in-browser.** Built: Auth.js credentials auth (register/login/guest), WorldMap (react-simple-maps, equirectangular), scoring engine + tests, round game loop (`useRound` hook) covering both modes, home/play/leaderboard pages, and the full API surface (`/api/rounds/start`, `/api/rounds/complete`, `/api/leaderboard`, `/api/countries`, `/api/register`). Manually tested: NAME mode (correct/incorrect scoring, decay curve), SHAPE mode (typed-answer matching via normalizeAnswer), signed-in round persisting to the leaderboard, guest round correctly *not* persisting. `npm run lint`, `tsc --noEmit`, `npm test`, and `npm run build` all pass clean. Not yet done: production DB + Netlify deploy (needs the user — see "Local development" below), polish/responsive pass, additional test coverage beyond scoring/normalization.
- 2026-09-11: **Visual/UX overhaul.** New dark "atlas at night" design system (CSS custom properties in globals.css, Space Grotesk display font), framer-motion throughout (button/card hover-tap, score count-up, round-summary confetti + performance message). WorldMap is now full-bleed and pannable/zoomable (react-simple-maps `ZoomableGroup`, graticule, bounded pan, auto-recenter per question, closer default zoom on narrow viewports to reduce letterboxing). All pages restyled to match; em dashes removed from user-facing copy. Fixed a critical bug (see below) where the round could freeze permanently after the second answered question.

## Local development

- Postgres runs locally via Docker Compose — no external DB account needed for dev.
- Production DB (Neon or Supabase) and Netlify hosting are set up later, by the user (account creation / OAuth grants aren't something Claude does on the user's behalf). Claude will flag when that point is reached.

## Known simplifications (MVP trade-offs)

- **Rounds are client-authoritative.** `/api/rounds/start` returns the full question list (country codes + names) up front, and the client tracks timing, scoring, and the running total itself; `/api/rounds/complete` just persists whatever final score/correct count the client reports for signed-in users. A motivated player could inspect network traffic to see answers early, or tamper with the client to report a higher score. Acceptable for a casual hobby leaderboard; would need server-side per-question state (round tokens, one question revealed at a time, server-computed scoring) to close if this ever mattered.

## framer-motion caution

`AnimatePresence`'s exit-tracking is unreliable in this project's dependency combo (React 19.2 + framer-motion ^13.2, Next.js 16 canary) — an exiting element can simply never unmount, permanently freezing whatever it was showing (this took down mid-round gameplay once; see the "stop game freezing" fix commit for the full diagnosis). **Avoid `AnimatePresence` for anything whose correctness depends on the old element actually disappearing** (i.e. most content swaps). A plain `key`-based remount (`<motion.div key={...} initial={...} animate={...}>`, no `AnimatePresence` wrapper, no `exit`) gives a reliable enter animation and drops old content instantly instead — that trade is worth it. `AnimatePresence` is still fine for pure decoration where a stuck exit wouldn't break anything functionally, but default to the plain-remount pattern first.

## Open questions / decisions to revisit

- Which country dataset/ID scheme to standardize on (ISO 3166-1 alpha-2/alpha-3) for matching TopoJSON features to DB records — decide before writing the country-matching logic, since it touches both frontend map data and backend leaderboard schema. **Resolved**: alpha-3, via i18n-iso-countries converting the TopoJSON's numeric ids.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
