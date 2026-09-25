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
v-1.0 -> dev -> main
```

- `main` — production, deploys via Netlify.
- `dev` — integration branch.
- `v-1.0` — current active development branch, working toward the project's first tagged release. Superseded `mvp` (merged and retired) once the MVP itself was done. Future work uses similarly named version/feature branches merging into `dev`, then `dev` into `main` — always through a PR (`gh pr create` / `gh pr merge`), never a direct fast-forward push, even though `dev`/`main` haven't diverged from each other so far.

Claude builds each version end-to-end on its branch. Commit attribution: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. `gh` CLI is installed and authenticated (as the user) for PR work.

### Commit conventions

- Small, modular commits — at least every ~5 minutes of work or ~100 lines, whichever comes first. No giant catch-all commits.
- Conventional commit prefixes: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/` (as scope prefixes in the branch/commit subject, e.g. `feat: add country selection logic`).
- Push to the current working branch (origin) regularly as work lands.
- Never commit secrets. `.env*` (except `.env.example`), DB credentials, and auth secrets are git-ignored — verify before every commit that nothing sensitive is staged.

## Status log

Keep this short — a running log of what's done, not a design doc. Prune entries that are no longer relevant once superseded by actual code.

- 2026-09-11: Repo created, stack + branch strategy decided. README and CLAUDE.md added on `main`. `dev` and `mvp` branches created.
- 2026-09-11: Next.js app scaffolded (App Router, TS, Tailwind). Local Postgres via Docker Compose (host port 5442 — 5432 is taken by other local projects). Prisma schema (User/Country/GameResult) + initial migration. Country table seeded from world-atlas TopoJSON with curated Easy/Medium/Hard tiers (195 countries: 59/82/54). Map data copied to `public/data/countries-50m.json`. Pinned prisma/@prisma-client to 6.12.0 (newer versions have unresolvable peer deps or high-severity transitive vulns).
- 2026-09-11: **MVP feature-complete and verified end-to-end in-browser.** Built: Auth.js credentials auth (register/login/guest), WorldMap (react-simple-maps, equirectangular), scoring engine + tests, round game loop (`useRound` hook) covering both modes, home/play/leaderboard pages, and the full API surface (`/api/rounds/start`, `/api/rounds/complete`, `/api/leaderboard`, `/api/countries`, `/api/register`). Manually tested: NAME mode (correct/incorrect scoring, decay curve), SHAPE mode (typed-answer matching via normalizeAnswer), signed-in round persisting to the leaderboard, guest round correctly *not* persisting. `npm run lint`, `tsc --noEmit`, `npm test`, and `npm run build` all pass clean. Not yet done: production DB + Netlify deploy (needs the user — see "Local development" below), polish/responsive pass, additional test coverage beyond scoring/normalization.
- 2026-09-11: **Visual/UX overhaul.** New dark "atlas at night" design system (CSS custom properties in globals.css, Space Grotesk display font), framer-motion throughout (button/card hover-tap, score count-up, round-summary confetti + performance message). WorldMap is now full-bleed and pannable/zoomable (react-simple-maps `ZoomableGroup`, graticule, bounded pan, auto-recenter per question, closer default zoom on narrow viewports to reduce letterboxing). All pages restyled to match; em dashes removed from user-facing copy. Fixed a critical bug (see below) where the round could freeze permanently after the second answered question.
- 2026-09-11: MVP merged `mvp -> dev -> main` **through actual GitHub PRs** (#1, #2) rather than direct fast-forward pushes — installed and authenticated the `gh` CLI for this.
- 2026-09-16: **Second design pivot: antique-cartography aesthetic**, replacing the dark navy/teal theme entirely (still token-only — every component already read color through globals.css's custom properties, so no per-component edits were needed beyond the map's own contrast fix). Parchment/sepia/brass palette, Cinzel display font, land/ocean given more contrast after the first pass made them too similar (inked-brown land vs. pale parchment sea). Added a three-stage landing flow on `/`: a space-themed hero (twinkling star field, the user's rotating-earth WebP — re-encoded from their GIF with the white background keyed to alpha — title, tagline, developer credit link to artembrandt.ca) that zooms into a setup screen (the mode/difficulty/round-length picker staged as a glass panel over a static WorldMap backdrop with a drifting CloudLayer), which itself zooms into `/play` on start. Transitions use a controlled framer-motion `animate` prop on a stably-mounted element rather than AnimatePresence exit animations, per the caution below. Branch strategy moved from `mvp` to versioned branches (`v-1.0` first), still merged to `dev`/`main` via PRs.
- 2026-09-16 (same day, second pass): Replaced the setup screen's CSS-blob clouds with the user's real LottieFiles cloud animation (`public/images/cloud.lottie`, dotLottie format via `@lottiefiles/dotlottie-react`), drifting continuously left to right. WorldMap gained optional `defaultZoom`/`defaultCenter` props so the decorative setup-screen map can start zoomed in further (fills the screen) without affecting gameplay's own default framing. **Fixed a real bug**: the wrong-guess feedback named the *target* country ("Not quite, it was Turkey") instead of what the player actually clicked — added `guessedCode` to `QuestionOutcome`, resolved via the country list (now fetched for both modes), and restyled the feedback banner as a small rotated ink-stamp badge (check/cross icon). Also reskinned the map's zoom controls as brass instrument dials and added a faint `CompassRose` watermark to the setup panel.
- 2026-09-22: Favicon is now the earth icon (`src/app/icon.png`, replacing the default Next.js triangle). Nav bar and setup-screen logos switched from the static earth.png to the rotating earth-rotating.webp (plain `<img>`, not `next/image`, since its optimizer can strip animation frames). The "Leaderboard" nav link is now the user's wooden-sign PNG instead of text. Cloud count went from 4 to 12, now drifting both directions (`drift-across` / `drift-across-reverse` keyframes) at varied heights/speeds/opacities for a proper "in the sky" feel. **Added `Particles`** (`src/components/landing/Particles.tsx`), a straight TypeScript port of react-bits' WebGL particle background (https://reactbits.dev/backgrounds/particles, MIT-style copy-paste component using `ogl`) — used as the hero scene's cosmos backdrop on a plain black background, replacing the old CSS-dot StarField (removed). **Redesigned the hero title layout**: new `ArcText` component lays text along a partial circular arc, character by character — "GEODEX" arches above the earth, a short tagline arcs below it in a mirrored-but-still-upright style (the math intentionally deviates from react-bits' CircularText full-wrap convention, which would render bottom-arc text upside down), "Developed by Artem Brandt" is now a prominent line instead of a small pinned footer, and Play comes last. Fixed a hydration mismatch this introduced (ArcText's computed transform values needed rounding — see the commit for why). Confirmed for the user: yes, this is a React app — Next.js is a React framework, so anything published as a React component (like react-bits') drops in directly.
- 2026-09-22 (same day, follow-up): **Fixed a real bug the Particles addition introduced**: the WebGL canvas was silently blocking clicks on the Play button (see the new WebGL caution below) — root-caused via `document.elementFromPoint`, fixed with `pointer-events-none` on the canvas's container and moving hover-tracking to a `window` listener. Also: doubled particle count (220 -> 440) and enabled `moveParticlesOnHover` per the user's request; doubled clouds again (12 -> 24, now array-generated instead of hand-listed); enlarged the whole hero emblem (~1.5x on desktop — earth 170px -> 280px, arc radii/fonts scaled to match, bigger "Developed by" line and Play button) since it was reading small against the black background on wide viewports, with a narrower size still used under 640px width (same responsive pattern as WorldMap's mobile zoom).
- 2026-09-22 (same day, third pass): Five polish fixes from user feedback with three annotated screenshots. **Nav bar logo** reverted from the rotating earth-rotating.webp back to the static earth.png (via `next/image`, safe since it's not animated) — the big hero earth and the setup panel's "Geodex" heading stay rotating; only the small top-left nav logo is static now, since both spinning at once read as visually busy. **Clouds** doubled again, 24 -> 48. **Nav bar flash on `/` fixed**: `NavVisibilityProvider` previously synced `hidden` to `pathname` inside a `useEffect`, so on first load of `/` the nav rendered for one frame before the effect hid it; switched to React's "adjust state during render" pattern (comparing `pathname` against a tracked-previous value in state, calling `setHidden` conditionally in the render body itself, not in an effect) — confirmed via `curl`ing the SSR'd HTML that `<header>` no longer appears at all for `/`. This "adjust state during render" pattern is the established fix in this codebase for "derive/reset state when a prop changes" whenever a `useEffect` version would trip the `react-hooks/set-state-in-effect` lint rule. **Hero particles**: doubled again (440 -> 880) and slowed down (`speed` 0.08 -> 0.05) since they read as moving too fast. **Setup-screen map preload**: `HeroScene` now fires background `fetch()` calls (draining the body via `.blob()`) for `/data/countries-50m.json` and `/data/country-codes.json` on mount, warming the browser's HTTP cache so `WorldMap`'s own fetches resolve instantly once the player reaches the setup screen instead of flashing in blank for ~0.1s.
- 2026-09-22 (same day, fourth pass): Three more fixes from annotated screenshots. **The setup screen is now its own `/setup` route** rather than internal stage state on `/` — the nav bar's "Geodex" link (plus "back to setup" and "play as a guest" links) used to point at `/`, which always replayed the cosmos hero intro; splitting the route means `NavVisibilityProvider`'s existing pathname check hides/shows the nav bar correctly with zero extra effect, and those links now jump straight to `/setup`. **WorldMap's side letterboxing eliminated**: `ComposableMap`'s internal viewBox is a fixed 4:3 (800x600), so `preserveAspectRatio`'s default `"xMidYMid meet"` scaled the whole SVG down to fit its height on any wider viewport, leaving empty margins on both sides; switched to `"xMidYMid slice"` to fill the container completely (cropping a bit of polar latitude instead). **Reveal flow overhauled**: replaced the old 1.2s auto-advance timer (`useRound`'s `advance()` is now called explicitly by a "Next question" button, so the round pauses indefinitely between questions) and gave `WorldMap` `correctCode`/`guessedCode` props (replacing `feedbackCode`/`feedbackCorrect`) — a correct guess zooms to fit and highlights just that country in green, a wrong guess highlights the guess in red and the answer in green and zooms to fit both, computed from the countries' lon/lat bounds projected through a local d3-geo instance matching `ComposableMap`'s untouched defaults. **Fixed a real bug this introduced**: d3-geo's `geoBounds` signals an antimeridian-crossing country (Russia, Fiji, ...) with `minLon > maxLon`; naively merging that into a plain min/max against another country's bounds produced a nonsense box (confirmed live — a Canada/Russia reveal zoomed in entirely inside Canada, cutting Russia off screen) — detected and handled by falling back to the default full-world framing for that case.
- 2026-09-24: **Post-login/round flow polish + a real reveal-zoom rewrite**, from live playtesting. Login, registration, and the round-summary "Home" button now redirect to `/setup` instead of `/` (landing back on the cosmos hero after signing in or finishing a round was jarring). Removed the setup screen's leftover `defaultZoom={1.9}` override on its decorative map — a pre-`preserveAspectRatio="slice"` fix that now just over-crops it to Africa/the Middle East instead of showing the whole earth. Setup panel enlarged (`max-w-2xl`→`max-w-3xl`, `p-8`→`p-10`) with bolder mode-card titles, and difficulty cards got a `--warning` (goldenrod) token alongside `--success`/`--danger` for green/yellow/red tinting. **Reveal-zoom got a real rewrite** after live testing turned up it was still cropping one of the two revealed countries (Finland/Sudan, Panama/Poland) despite last session's fixes: the fit math was sizing against the full 800x600 viewBox rather than the sub-region `preserveAspectRatio="slice"` actually leaves visible (now measured live via `ResizeObserver`), and — the bigger one — `ZoomableGroup`'s `translateExtent` is **not** a zoom-scaled range of raw translate pixels (an early fix attempt assumed this and was confirmed broken live: dragging different distances all settled on the identical wrong transform); it's a fixed rectangle in the untransformed content's own coordinate space that d3-zoom's own `constrain` function checks via `invertX`/`invertY` at whatever the current zoom is. Replaced with a single static `WORLD_TRANSLATE_EXTENT` (the map's true content bounds) and let d3-zoom's built-in constrain handle the rest — which, as a side effect, also fixed a separately-reported bug where dragging the map far in one direction exposed a large empty margin instead of stopping at the content's edge. The teleport-to-reveal snap is now a smooth 700ms animated pan/zoom (framer-motion's standalone `animate()`, same technique as `AnimatedScore`), applied to both the reveal focus and the between-questions reset. Also added a pulsating glow (`geo-correct-pulse`/`geo-incorrect-pulse`) on the revealed countries — they were easy to miss against similarly-toned neighbors — and widened the gap between the difficulty cards' active/inactive styling (6% vs 40% color-mix, plus a ring and checkmark badge) since the three colors read as nearly identical at rest.

## Local development

- Postgres runs locally via Docker Compose — no external DB account needed for dev.
- Production DB (Neon or Supabase) and Netlify hosting are set up later, by the user (account creation / OAuth grants aren't something Claude does on the user's behalf). Claude will flag when that point is reached.
- The in-app browser tool has occasionally shown **stale rendering frames** (a screenshot showing content shifted/off-center, or a coordinate-based click silently doing nothing) even though the page's actual DOM/layout is correct. If something looks visually wrong but the code looks right, verify with `getBoundingClientRect()` / dispatching a real `MouseEvent` via `javascript_exec` before assuming it's a real bug — a hard reload (`navigate` with `force: true`) has also cleared it.

## Known simplifications (MVP trade-offs)

- **Rounds are client-authoritative.** `/api/rounds/start` returns the full question list (country codes + names) up front, and the client tracks timing, scoring, and the running total itself; `/api/rounds/complete` just persists whatever final score/correct count the client reports for signed-in users. A motivated player could inspect network traffic to see answers early, or tamper with the client to report a higher score. Acceptable for a casual hobby leaderboard; would need server-side per-question state (round tokens, one question revealed at a time, server-computed scoring) to close if this ever mattered.

## framer-motion caution

`AnimatePresence`'s exit-tracking is unreliable in this project's dependency combo (React 19.2 + framer-motion ^13.2, Next.js 16 canary) — an exiting element can simply never unmount, permanently freezing whatever it was showing (this took down mid-round gameplay once; see the "stop game freezing" fix commit for the full diagnosis). **Avoid `AnimatePresence` for anything whose correctness depends on the old element actually disappearing** (i.e. most content swaps). A plain `key`-based remount (`<motion.div key={...} initial={...} animate={...}>`, no `AnimatePresence` wrapper, no `exit`) gives a reliable enter animation and drops old content instantly instead — that trade is worth it. `AnimatePresence` is still fine for pure decoration where a stuck exit wouldn't break anything functionally, but default to the plain-remount pattern first.

## WebGL canvas caution

A `<canvas>` from a WebGL library (we hit this with `ogl`, in `Particles.tsx`) can end up compositing **above** regular DOM content in this environment regardless of DOM order or z-index — confirmed via `document.elementFromPoint`, which returned the canvas for a point squarely inside a button rendered *later* in the DOM, silently eating its clicks (this is exactly what broke the hero's Play button). Any decorative canvas/WebGL layer needs **`pointer-events: none`** on its container, full stop — don't rely on stacking order to keep it non-interactive. If the effect needs pointer input (e.g. `moveParticlesOnHover`), track it via a `window`-level listener instead of one on the (now pointer-events-none) container.

## Open questions / decisions to revisit

- Which country dataset/ID scheme to standardize on (ISO 3166-1 alpha-2/alpha-3) for matching TopoJSON features to DB records — decide before writing the country-matching logic, since it touches both frontend map data and backend leaderboard schema. **Resolved**: alpha-3, via i18n-iso-countries converting the TopoJSON's numeric ids.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
