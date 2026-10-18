-- Pace — Phase 2 schema additions. Run after docs/SCHEMA.sql.
--   psql "$TIGER_DATABASE_URL" -f docs/SCHEMA_PHASE2.sql
--
-- Small and additive. Nothing here alters an existing table, so running it
-- cannot break the working MVP.

-- =========================================================== Stage 11
-- Logs when a user says an insight did not match how they actually felt.
-- Two purposes: it is honest (the detector can be wrong), and it is a
-- visible thoughtfulness signal when a judge asks how you handle false
-- positives.

CREATE TABLE IF NOT EXISTS insight_dismissals (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL,
  pattern    TEXT        NOT NULL,
  day        DATE        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pattern, day)
);

CREATE INDEX IF NOT EXISTS insight_dismissals_user_idx
  ON insight_dismissals (user_id, day DESC);

-- A dismissal suppresses that pattern for that user for the rest of the day.
-- The UNIQUE constraint makes a repeat dismissal a no-op rather than an error.

-- =========================================================== Stage 14 only
-- Skip these two unless you are building the optional Socratic quiz.

CREATE TABLE IF NOT EXISTS skill_goals (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL,
  title                 TEXT        NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 140),
  milestone_description TEXT        NOT NULL CHECK (length(trim(milestone_description)) BETWEEN 1 AND 500),
  current_question      TEXT,
  verified_at           TIMESTAMPTZ,
  points_earned         INTEGER     NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skill_goals_user_idx ON skill_goals (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    UUID        NOT NULL REFERENCES skill_goals(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL,
  question   TEXT        NOT NULL,
  answer     TEXT        NOT NULL,
  passed     BOOLEAN     NOT NULL,
  feedback   TEXT,
  was_pasted BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- quiz_attempts doubles as the rate limiter: count a user's rows in the last
-- hour before calling Gemini.
CREATE INDEX IF NOT EXISTS quiz_attempts_rate_idx ON quiz_attempts (user_id, created_at DESC);

-- =========================================================== verify
-- Expect: insight_dismissals, plus skill_goals and quiz_attempts if you ran
-- the Stage 14 section.

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('insight_dismissals', 'skill_goals', 'quiz_attempts')
ORDER BY 1;
