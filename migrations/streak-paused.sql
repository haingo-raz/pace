-- Stage 23: streak pause/deactivate.
-- Adds a per-user flag that freezes the streak counter.
-- Safe to re-run.
--
-- Apply once against TigerData:
--   psql "$TIGER_DATABASE_URL" -f migrations/2026_10_18_streak_paused.sql

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_paused BOOLEAN NOT NULL DEFAULT false;
