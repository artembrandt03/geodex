# Geodex — Project Notes for Claude

This file is project memory: decisions, conventions, and status that aren't obvious from the code alone. Keep it up to date as the project evolves — update it in the same commit as the change it describes, don't let it drift.

## What this is

A geography guessing game on an interactive world map (cylindrical/equirectangular projection). Solo hobby project, being built almost entirely by Claude Code as an experiment in AI-driven full-stack development. The user (Artem) is directing scope/product decisions; Claude owns implementation.

## Game design (MVP)

Two modes:
1. **Guess by name** — country name shown as a prompt; player clicks the matching country on the map.
2. **Guess by shape** — a country is highlighted on the map; player identifies it by name (typed/selected).

Difficulty = round length: **5 / 10 / 15 / 20 countries** per round. (Open question: does difficulty also affect *which* countries are chosen — e.g. easy = well-known, hard = obscure — or is it purely round length for MVP? Resolve before building the country-selection logic.)

Accounts:
- Register/login required to appear on the leaderboard.
- Guest play allowed, but guest scores are not persisted to the leaderboard.

Leaderboards: scoped per mode + difficulty.

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

## Status log

Keep this short — a running log of what's done, not a design doc. Prune entries that are no longer relevant once superseded by actual code.

- 2026-09-11: Repo created, stack + branch strategy decided. README and CLAUDE.md added on `main`. `dev` and `mvp` branches created. Scaffolding not yet started.

## Open questions / decisions to revisit

- Country difficulty weighting (see Game design above).
- Exact scoring formula (time-based? accuracy-based? both?).
- Which country dataset/ID scheme to standardize on (ISO 3166-1 alpha-2/alpha-3) for matching TopoJSON features to DB records — decide before writing the country-matching logic, since it touches both frontend map data and backend leaderboard schema.
