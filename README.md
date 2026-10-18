# Pace

A wellbeing companion for a job search. Pace notices how you have actually been
over the last two weeks and says so, instead of celebrating a streak you did
not enjoy. One mood a day, a short task list that reorders itself, points you
spend on a colouring page, and a quiet AI layer that keeps the day paced.

> Job searching is a full-time job with no manager, so nobody paces your
> workload or notices you've been grinding for three weeks.

---

## Features

- **Daily mood check-in.** Rough / Okay / Good / Great. Rewarded with points,
  surfaces a mood-tuned motivational quote.
- **Smart task list.** Difficulty 1-10, optional deadline, optional group.
  Tasks reorder themselves based on today's mood so Rough days surface the
  lighter work first.
- **Points and streak.** Points reward showing up, not grinding. Streak can be
  paused from Settings without losing the count.
- **Colouring (Redeem) page.** Spend points filling sections of hand-authored
  SVG illustrations: a flower and a landscape. Each account keeps its own
  per-section colour state.
- **14-day insights.** A deterministic rules engine watches for seven
  patterns: grinding, sustained low mood, climbing effort against falling
  energy, deadlines slipping, no recovery, late nights, and genuine recovery.
  Gemini phrases the detected pattern as one short sentence, cached per user
  per day in Postgres so re-opening the dashboard does not re-generate it.
- **Stats page.** Daily points bar, weekly mood line, streak, totals, and
  the same insight card as the dashboard.
- **SMART goal planner.** Turns a vague goal like `apply to 30 jobs this
  week` into an editable set of daily tasks. Pushes back on unsustainable
  volume. Reads your mood, employment status, and preferred name so the
  plan fits your situation.
- **In-app AI assistant.** Draggable chat bubble on every page. Add, rename,
  reschedule, change difficulty, move between groups, complete, reopen, or
  delete tasks in plain English. Answers questions about Pace itself from a
  fixed knowledge base. Scope is enforced server-side by classifying each
  message into a closed intent enum before any database call.
- **Personalisation.** Preferred name and employment status (full-time,
  part-time, unemployed, volunteer, student, with full-time and part-time
  variants) feed into the planner, the assistant, and the dashboard
  greeting.
- **Accessibility first.** Keyboard operable throughout, visible focus
  rings, labelled controls, WCAG 2.2 AA colour contrast, light and dark
  themes, screen-reader announcements for important state changes
  including on the colouring canvas.

---

## Stack

| Layer | Choice | What it does here |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) + React 19 | Server Components for every page, Route Handlers under `src/app/api/*` for mutations, Vercel-ready |
| Styling | Tailwind CSS v4 | Design system via CSS variables (`--primary-strong`, `--surface`, `--raised`, `--border`, `--text`, `--muted`) resolved per theme; same utility renders in both modes |
| Auth | Supabase (`@supabase/supabase-js` + `@supabase/ssr`) | Email + password with cookie-based sessions. **Auth only.** No table data in Supabase. |
| App database | TigerData (Postgres + TimescaleDB) via `postgres.js` | Every application row. `checkins` and `points_log` are hypertables. `points_daily` and `mood_weekly` are continuous aggregates refreshed in real time, so the stats page is fast at any scale. |
| AI | Gemini via `@google/genai` | Four surfaces: dashboard insight phrasing, SMART goal planner, assistant intent classifier, assistant Q&A reply. All use structured JSON output; insight responses are cached per user per day. |
| Validation | `zod` | Every API request body |
| Icons | `lucide-react` | |
| Hosting | Vercel | |

---

## Prerequisites

- **Node 20 or newer**, `npm` 10+
- **Supabase** project (free tier is fine) for authentication
- **TigerData** service (free tier is fine) for the application database
- **Google AI Studio** API key for Gemini features (free tier)

A Vercel account is only needed if you want to deploy.

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/haingo-raz/pace.git
cd pace
npm install
```

### 2. Supabase (auth only)

Create a project at [supabase.com](https://supabase.com/dashboard):

- Settings -> API: copy the project URL and the publishable (anon) key
- Authentication -> Providers -> Email: enable, and **turn "Confirm email" OFF** for local dev
- Authentication -> URL Configuration: set Site URL to `http://localhost:3000`

### 3. TigerData (application database)

Create a free service at [console.cloud.tigerdata.com](https://console.cloud.tigerdata.com). Copy the full `postgresql://...` connection string.

Apply the schema and seed data in order:

```bash
psql "$TIGER_DATABASE_URL" -f migrations/SCHEMA.sql
psql "$TIGER_DATABASE_URL" -f migrations/SCHEMA_PHASE2.sql
psql "$TIGER_DATABASE_URL" -f migrations/SCHEMA_PHASE3.sql
psql "$TIGER_DATABASE_URL" -f migrations/streak-paused.sql
psql "$TIGER_DATABASE_URL" -f migrations/personalization.sql
psql "$TIGER_DATABASE_URL" -f migrations/coloring-fixes.sql
psql "$TIGER_DATABASE_URL" -f migrations/seed-coloring.sql
```

Each migration is idempotent, so re-running is safe.

### 4. Gemini API key

Get a key from [aistudio.google.com](https://aistudio.google.com/apikey).

### 5. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
TIGER_DATABASE_URL=
GEMINI_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> `.env.local` is gitignored. Do not commit it.

### 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and you are in.

---

## Scripts

```bash
npm run dev          # Next.js dev server
npm run build        # production build
npm run start        # run the production build
npm run lint         # eslint
npx tsc --noEmit     # typecheck
```

---

## Project layout

```
pace/
  README.md                     this file
  migrations/                   human-runnable SQL. Idempotent. Apply in order.
  src/
    app/                        App Router pages and Route Handlers
    components/                 UI components (Server + Client)
    content/en.ts               every user-facing string (one typed object)
    config/constants.ts         every number, threshold and point value
    lib/                        db client, queries, auth, AI, formatting
    types/                      shared types
```

---

## Architecture notes

Two Postgres databases cannot join, so splitting data across Supabase and
TigerData would mean stitching every query by hand. Consequences the code
enforces:

- `supabase.from(...)` must never appear in this codebase. Only
  `supabase.auth.*` is allowed. The `verify` skill greps for this.
- There is no Row Level Security backstop. **Every query that touches
  user data carries `where user_id = ${userId}` explicitly.** That is
  the entire authorization model.
- Database access happens only in Route Handlers and Server Components.
  Never in a Client Component. A `'use client'` file may only read
  `NEXT_PUBLIC_*` env vars.
- Points are awarded server-side only. The client posts an action, never
  a point total or a score.
- Daily point awards are idempotent in SQL. Opening the app twice in one
  day awards once.

---

## Author

Created by [haingo-raz](https://github.com/haingo-raz).
