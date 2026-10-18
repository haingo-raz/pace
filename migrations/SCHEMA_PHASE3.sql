-- Pace — Phase 3 schema additions. Run after SCHEMA.sql (and SCHEMA_PHASE2.sql
-- if you ran that). Additive only; nothing here alters existing data.
--
-- Run with: psql "$TIGER_DATABASE_URL" -f docs/SCHEMA_PHASE3.sql

BEGIN;

-- =========================================================== Stage 16
-- Task groups replace the mood-based ordering. One group is a logical cluster
-- of related tasks, typically produced by one AI planning call.

CREATE TABLE IF NOT EXISTS task_groups (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL,
  title      TEXT        NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  position   INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_groups_user_idx ON task_groups (user_id, position);

-- Tasks get an optional group and an in-group position.
-- No FK to task_groups: a soft reference is enough for a demo and lets us
-- survive a group deletion by orphaning tasks (they become ungrouped).

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 1000;

CREATE INDEX IF NOT EXISTS tasks_user_group_pos_idx
  ON tasks (user_id, group_id NULLS FIRST, position);

-- Position scheme: integers spaced by 1000 (1000, 2000, 3000) so a drag can
-- insert in between (e.g. 1500) without renumbering everything. Renumber in
-- application code when gaps shrink below 2.

-- =========================================================== Stage 20
-- Per-page active drawings. The old index enforced one active drawing per
-- user; now we want one active drawing per (user, page).

DROP INDEX IF EXISTS user_drawings_one_active_idx;

CREATE UNIQUE INDEX IF NOT EXISTS user_drawings_one_active_per_page_idx
  ON user_drawings (user_id, page_id) WHERE completed_at IS NULL;

COMMIT;

-- =========================================================== verify
SELECT column_name FROM information_schema.columns
WHERE table_name='tasks' AND column_name IN ('group_id','position')
ORDER BY 1;

SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name='task_groups';
