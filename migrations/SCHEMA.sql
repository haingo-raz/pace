-- Pace — MVP schema. Run top to bottom against your TigerData service:
--   psql "$TIGER_DATABASE_URL" -f docs/SCHEMA.sql
-- Or paste in sections into Tiger Console (SQL Editor, or Data view Scratchpad).
-- Safe to re-run: every statement is guarded or idempotent.
--
-- All application tables live here. Supabase holds auth only, so user_id is
-- the Supabase auth UUID with no foreign key to it.

-- ---------------------------------------------------------------- extensions

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------ profiles
-- One row per user, created on first sign-in.
-- last_visit_day is the idempotency guard for the daily +5.

CREATE TABLE IF NOT EXISTS profiles (
  user_id           UUID PRIMARY KEY,
  points_total      INTEGER     NOT NULL DEFAULT 0 CHECK (points_total >= 0),
  streak_count      INTEGER     NOT NULL DEFAULT 0 CHECK (streak_count >= 0),
  last_visit_day    DATE,
  last_streak_day   DATE,
  timezone          TEXT        NOT NULL DEFAULT 'America/Toronto',
  streak_paused     BOOLEAN     NOT NULL DEFAULT false,
  employment_status TEXT CHECK (employment_status IS NULL OR employment_status IN (
    'full_time','part_time','unemployed',
    'volunteer_full_time','volunteer_part_time',
    'student_full_time','student_part_time'
  )),
  preferred_name    TEXT CHECK (preferred_name IS NULL
                                OR char_length(trim(preferred_name)) BETWEEN 1 AND 60),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------- insight_cache
-- Caches the Gemini-phrased sentence for the daily insight so router.refresh()
-- and visits to the Stats tab reuse the same text instead of recalling Gemini.

CREATE TABLE IF NOT EXISTS insight_cache (
  user_id    UUID        NOT NULL,
  day        DATE        NOT NULL,
  kind       TEXT        NOT NULL,
  numbers    JSONB       NOT NULL,
  sentence   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
-- streak_paused freezes streak_count: runDailyVisit skips streak updates
-- while true; on resume, last_streak_day is reset to today so counting
-- continues from the preserved value.

-- points_total is a cache of sum(points_log.amount), updated in the same
-- transaction as every ledger insert. The CHECK makes an overspend bug fail
-- loudly instead of going negative in silence.

-- --------------------------------------------------------------------- tasks

CREATE TABLE IF NOT EXISTS tasks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL,
  title         TEXT        NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 140),
  difficulty    SMALLINT    CHECK (difficulty BETWEEN 1 AND 10),
  deadline      TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  points_earned INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_user_open_idx
  ON tasks (user_id, completed_at NULLS FIRST, created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_user_deadline_idx
  ON tasks (user_id, deadline) WHERE completed_at IS NULL;

-- difficulty is nullable: a task starts unrated, and rating it awards +5
-- exactly once, on the null -> value transition.

-- ------------------------------------------------------------ coloring pages
-- Seeded content. sections is [{ id, d, label }] where d is an SVG path.

CREATE TABLE IF NOT EXISTS coloring_pages (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT     NOT NULL UNIQUE,
  name           TEXT     NOT NULL,
  view_box       TEXT     NOT NULL DEFAULT '0 0 400 210',
  sections       JSONB    NOT NULL,
  total_sections SMALLINT NOT NULL
);

-- ------------------------------------------------------------- user drawings
-- In-progress colour state lives here as JSONB. Nothing is uploaded anywhere.

CREATE TABLE IF NOT EXISTS user_drawings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL,
  page_id        UUID        NOT NULL REFERENCES coloring_pages(id),
  sections_state JSONB       NOT NULL DEFAULT '{}'::jsonb,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active (incomplete) drawing per user at a time.
CREATE UNIQUE INDEX IF NOT EXISTS user_drawings_one_active_idx
  ON user_drawings (user_id) WHERE completed_at IS NULL;

-- sections_state shape: { "arc-3": "#6BAE8F", "arc-5": "#E8845A" }
-- A key's presence means filled, so the refill check is one operator:
--   SELECT sections_state ? 'arc-3' FROM user_drawings WHERE id = $1;

-- ----------------------------------------------------- checkins (hypertable)
-- Partitioned on day (a DATE) deliberately: a hypertable's unique constraint
-- must include the partitioning column, and we need UNIQUE (user_id, day) for
-- one-check-in-per-day idempotency.

CREATE TABLE IF NOT EXISTS checkins (
  day        DATE        NOT NULL,
  user_id    UUID        NOT NULL,
  mood_score SMALLINT    NOT NULL CHECK (mood_score BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
) WITH (
  timescaledb.hypertable,
  timescaledb.partition_column = 'day'
);

-- --------------------------------------------------- points_log (hypertable)
-- Append-only ledger. No primary key by design: a hypertable PK must include
-- the partition column, and a surrogate id adds nothing to an append-only log.

CREATE TABLE IF NOT EXISTS points_log (
  time    TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID        NOT NULL,
  amount  INTEGER     NOT NULL,
  reason  TEXT        NOT NULL
) WITH (
  timescaledb.hypertable,
  timescaledb.partition_column = 'time'
);

CREATE INDEX IF NOT EXISTS points_log_user_time_idx ON points_log (user_id, time DESC);

-- reason is a closed set, mirrored in src/config/constants.ts and used
-- verbatim: daily_visit, mood_checkin, rate_difficulty, task_complete,
-- task_complete_on_time, color_section (negative).

-- FALLBACK 1 — if either CREATE TABLE ... WITH (timescaledb.hypertable) above
-- is rejected, create the table as a plain table (drop the whole WITH clause)
-- and convert it afterwards:
--
--   SELECT create_hypertable('points_log', by_range('time'));
--   SELECT create_hypertable('checkins',   by_range('day'));
--
-- FALLBACK 2 — if partitioning checkins on a DATE column is rejected, leave
-- checkins as a plain table. Keep its UNIQUE (user_id, day) constraint, which
-- is what the check-in idempotency depends on. points_log alone is enough to
-- demonstrate hypertables; nothing in the app behaves differently.

-- ------------------------------------------------- continuous aggregates
-- Not used by the MVP. Created now so the schema is run once rather than
-- twice; the stats page reads these rather than the raw hypertables.

CREATE MATERIALIZED VIEW IF NOT EXISTS points_daily
WITH (timescaledb.continuous) AS
SELECT user_id,
       time_bucket('1 day', time) AS day,
       sum(amount)                AS points,
       count(*)                   AS events
FROM points_log
GROUP BY user_id, day
WITH NO DATA;

SELECT add_continuous_aggregate_policy('points_daily',
  start_offset      => INTERVAL '30 days',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists     => true);

CREATE MATERIALIZED VIEW IF NOT EXISTS mood_weekly
WITH (timescaledb.continuous) AS
SELECT user_id,
       time_bucket('7 days', day)    AS week,
       avg(mood_score)::numeric(3,2) AS avg_mood,
       count(*)                      AS checkins
FROM checkins
GROUP BY user_id, week
WITH NO DATA;

SELECT add_continuous_aggregate_policy('mood_weekly',
  start_offset      => INTERVAL '90 days',
  end_offset        => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists     => true);

-- ------------------------------------------------------------- seed: rainbow
-- Seven concentric semicircular bands centred at (200, 200), radii 50 to 190.
-- Hand-authored geometry: every band is its own addressable path.

INSERT INTO coloring_pages (slug, name, view_box, sections, total_sections)
VALUES (
  'rainbow',
  'Rainbow',
  '0 0 400 210',
  '[
    {"id":"arc-1","label":"Band 1, innermost","d":"M 130 200 A 70 70 0 0 1 270 200 L 250 200 A 50 50 0 0 0 150 200 Z"},
    {"id":"arc-2","label":"Band 2","d":"M 110 200 A 90 90 0 0 1 290 200 L 270 200 A 70 70 0 0 0 130 200 Z"},
    {"id":"arc-3","label":"Band 3","d":"M 90 200 A 110 110 0 0 1 310 200 L 290 200 A 90 90 0 0 0 110 200 Z"},
    {"id":"arc-4","label":"Band 4","d":"M 70 200 A 130 130 0 0 1 330 200 L 310 200 A 110 110 0 0 0 90 200 Z"},
    {"id":"arc-5","label":"Band 5","d":"M 50 200 A 150 150 0 0 1 350 200 L 330 200 A 130 130 0 0 0 70 200 Z"},
    {"id":"arc-6","label":"Band 6","d":"M 30 200 A 170 170 0 0 1 370 200 L 350 200 A 150 150 0 0 0 50 200 Z"},
    {"id":"arc-7","label":"Band 7, outermost","d":"M 10 200 A 190 190 0 0 1 390 200 L 370 200 A 170 170 0 0 0 30 200 Z"}
  ]'::jsonb,
  7
)
ON CONFLICT (slug) DO UPDATE
  SET sections = EXCLUDED.sections,
      view_box = EXCLUDED.view_box,
      total_sections = EXCLUDED.total_sections;

-- ------------------------------------------------------------ verify
-- Expect: checkins, points_log

SELECT hypertable_name FROM timescaledb_information.hypertables ORDER BY 1;

-- Expect: mood_weekly, points_daily

SELECT view_name FROM timescaledb_information.continuous_aggregates ORDER BY 1;

-- Expect: one row, total_sections = 7

SELECT slug, total_sections, jsonb_array_length(sections) AS paths FROM coloring_pages;
