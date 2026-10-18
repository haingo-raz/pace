-- Pace — Stage 20: coloring page seeds.
-- Idempotent: upserts flower + landscape by slug. Hand-authored geometric SVG,
-- each section an addressable <path> with a stable id.
--
-- Run with: psql "$TIGER_DATABASE_URL" -f db/seed-coloring.sql

BEGIN;

-- ------------------------------------------------------------------- flower
INSERT INTO coloring_pages (slug, name, view_box, sections, total_sections)
VALUES (
  'flower',
  'Flower',
  '0 0 400 400',
  $json$[
    {"id":"stem",              "label":"Stem",               "d":"M194 240 L 194 380 L 206 380 L 206 240 Z"},
    {"id":"petal-top",         "label":"Top petal",          "d":"M200 60 C 240 90, 240 150, 200 180 C 160 150, 160 90, 200 60 Z"},
    {"id":"petal-top-right",   "label":"Top-right petal",    "d":"M299 101 C 303 150, 262 191, 213 187 C 211 134, 250 95, 299 101 Z"},
    {"id":"petal-right",       "label":"Right petal",        "d":"M340 200 C 310 240, 250 240, 220 200 C 250 160, 310 160, 340 200 Z"},
    {"id":"petal-bottom-right","label":"Bottom-right petal", "d":"M299 299 C 250 303, 209 262, 213 213 C 262 211, 303 250, 299 299 Z"},
    {"id":"petal-bottom",      "label":"Bottom petal",       "d":"M200 340 C 160 310, 160 250, 200 220 C 240 250, 240 310, 200 340 Z"},
    {"id":"petal-bottom-left", "label":"Bottom-left petal",  "d":"M101 299 C 97 250, 138 209, 187 213 C 189 262, 150 303, 101 299 Z"},
    {"id":"petal-left",        "label":"Left petal",         "d":"M60 200 C 90 160, 150 160, 180 200 C 150 240, 90 240, 60 200 Z"},
    {"id":"petal-top-left",    "label":"Top-left petal",     "d":"M101 101 C 150 97, 191 138, 187 187 C 138 189, 97 150, 101 101 Z"},
    {"id":"centre",            "label":"Centre",             "d":"M200 170 A 30 30 0 1 0 200 230 A 30 30 0 1 0 200 170 Z"}
  ]$json$::jsonb,
  10
)
ON CONFLICT (slug) DO UPDATE SET
  name           = EXCLUDED.name,
  view_box       = EXCLUDED.view_box,
  sections       = EXCLUDED.sections,
  total_sections = EXCLUDED.total_sections;

-- ---------------------------------------------------------------- landscape
INSERT INTO coloring_pages (slug, name, view_box, sections, total_sections)
VALUES (
  'landscape',
  'Landscape',
  '0 0 400 400',
  $json$[
    {"id":"sky",            "label":"Sky",            "d":"M0 0 L 400 0 L 400 240 L 0 240 Z"},
    {"id":"sun",            "label":"Sun",            "d":"M300 100 A 36 36 0 1 0 300 172 A 36 36 0 1 0 300 100 Z"},
    {"id":"mountain-left",  "label":"Left mountain",  "d":"M0 240 L 110 120 L 220 240 Z"},
    {"id":"mountain-right", "label":"Right mountain", "d":"M180 240 L 290 150 L 400 240 Z"},
    {"id":"hill",           "label":"Hill",           "d":"M0 240 Q 200 200, 400 240 L 400 300 L 0 300 Z"},
    {"id":"grass",          "label":"Grass",          "d":"M0 300 L 400 300 L 400 400 L 0 400 Z"},
    {"id":"tree-left",      "label":"Left tree",      "d":"M70 260 L 55 290 L 65 290 L 50 315 L 68 315 L 55 340 L 85 340 L 72 315 L 90 315 L 75 290 L 85 290 L 70 260 Z"},
    {"id":"tree-right",     "label":"Right tree",     "d":"M330 255 L 310 290 L 322 290 L 305 320 L 325 320 L 310 350 L 350 350 L 335 320 L 355 320 L 338 290 L 350 290 L 330 255 Z"}
  ]$json$::jsonb,
  8
)
ON CONFLICT (slug) DO UPDATE SET
  name           = EXCLUDED.name,
  view_box       = EXCLUDED.view_box,
  sections       = EXCLUDED.sections,
  total_sections = EXCLUDED.total_sections;

COMMIT;

-- =========================================================== verify
SELECT slug, name, total_sections FROM coloring_pages ORDER BY slug;
