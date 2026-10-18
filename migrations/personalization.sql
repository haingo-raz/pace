-- Profile personalization + insight cache.
-- Idempotent. Run against TigerCloud:
--   psql "$TIGER_DATABASE_URL" -f migrations/2026_10_18_stage24.sql

-- ---- Profile fields ------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS employment_status TEXT,
  ADD COLUMN IF NOT EXISTS preferred_name    TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_employment_status_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_employment_status_check
      CHECK (employment_status IS NULL OR employment_status IN (
        'full_time',
        'part_time',
        'unemployed',
        'volunteer_full_time',
        'volunteer_part_time',
        'student_full_time',
        'student_part_time'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_preferred_name_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_preferred_name_check
      CHECK (preferred_name IS NULL
             OR char_length(trim(preferred_name)) BETWEEN 1 AND 60);
  END IF;
END $$;

-- ---- Insight cache -------------------------------------------------------
-- One sentence per user per day. We regenerate when any of (kind, numbers)
-- change, so the Gemini call fires on real-content changes, not on each
-- router.refresh().

CREATE TABLE IF NOT EXISTS insight_cache (
  user_id    UUID        NOT NULL,
  day        DATE        NOT NULL,
  kind       TEXT        NOT NULL,
  numbers    JSONB       NOT NULL,
  sentence   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
