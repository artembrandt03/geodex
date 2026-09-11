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

- 2026-09-11: Repo created, stack + branch strategy decided. README and CLAUDE.md added on `main`. `dev` and `mvp` branches created. Scaffolding not yet started.

## Local development

- Postgres runs locally via Docker Compose — no external DB account needed for dev.
- Production DB (Neon or Supabase) and Netlify hosting are set up later, by the user (account creation / OAuth grants aren't something Claude does on the user's behalf). Claude will flag when that point is reached.

## Open questions / decisions to revisit

- Which country dataset/ID scheme to standardize on (ISO 3166-1 alpha-2/alpha-3) for matching TopoJSON features to DB records — decide before writing the country-matching logic, since it touches both frontend map data and backend leaderboard schema.
