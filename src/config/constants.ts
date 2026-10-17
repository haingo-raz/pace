/** First page load of a calendar day. */
export const POINTS_DAILY_VISIT = 5
/** Submitting the optional mood check-in. */
export const POINTS_MOOD_CHECKIN = 10
/** Rating a task's difficulty, once per task. */
export const POINTS_RATE_DIFFICULTY = 5
/** Completing a task with no deadline set. */
export const POINTS_TASK_COMPLETE = 20
/** Completing a task on or before its deadline. */
export const POINTS_TASK_ON_TIME = 30
/** Cost to fill one section of a colouring page. */
export const COST_COLOR_SECTION = 2

export const DIFFICULTY_MIN = 1
export const DIFFICULTY_MAX = 10
export const DIFFICULTY_DEFAULT = 5
export const DIFFICULTY_STEP = 1
/** At or below this is light work. */
export const DIFFICULTY_LIGHT_MAX = 3
/** At or above this is heavy work. */
export const DIFFICULTY_HEAVY_MIN = 7

export const TASK_TITLE_MAX = 140
export const TASK_GROUP_TITLE_MAX = 80
/** Default fallback title when the planner proposes a blank group name. */
export const TASK_GROUP_DEFAULT_TITLE = 'Plan'
export const SECTION_ID_MAX = 64

export const GEMINI_MODEL = 'gemini-3.5-flash-lite'
export const GEMINI_TIMEOUT_MS = 12_000
/** Short timeout for the insight-phrasing call so a slow Gemini doesn't block first paint. */
export const GEMINI_PHRASE_TIMEOUT_MS = 1_500
export const MS_PER_DAY = 86_400_000
/** Rounding factor for one decimal place. */
export const ONE_DECIMAL = 10
/** Mood scale endpoints — mirrors MoodScore. */
export const MOOD_MIN = 1
export const MOOD_MAX = 4
/** Max daily effort shown on the sparkline. */
export const INSIGHT_EFFORT_SPARK_MAX = 20
/** Max daily late-event count shown on the sparkline. */
export const INSIGHT_LATE_SPARK_MAX = 6

/** Stats page range bounds. */
export const STATS_DAYS_MIN = 7
export const STATS_DAYS_MAX = 30
export const STATS_DAYS_DEFAULT = 14
/** Below this many check-ins the stats page shows the empty-state line. */
export const STATS_MIN_DATA_DAYS = 3
export const MAX_GENERATED_TASKS = 7
export const GOAL_PLAN_MAX_PER_HOUR = 10
/** A missed day of streak within this window keeps the streak alive. */
export const STREAK_GRACE_DAYS = 2

/** Insights detection — window and thresholds. */
export const INSIGHT_WINDOW_DAYS = 14
export const INSIGHT_HALF_WINDOW_DAYS = 7
export const INSIGHT_MIN_CHECKINS = 5
export const INSIGHT_GRIND_STREAK_MIN = 5
export const INSIGHT_GRIND_MOOD_DROP = 0.5
export const INSIGHT_LOW_MOOD_MAX = 2
export const INSIGHT_LOW_CONSEC_DAYS = 3
export const INSIGHT_EFFORT_RATIO = 1.25
export const INSIGHT_DEADLINES_MISSED_MIN = 3
export const INSIGHT_NOT_RECOVERING_POINTS = 40
export const INSIGHT_LATE_RATIO = 2
export const INSIGHT_LATE_MIN = 3
/** When a task has no difficulty, treat it as this when summing effort. */
export const INSIGHT_UNRATED_EFFORT = 5
/** Local hours that count as a "late night" point-event. 23:00–03:59 inclusive. */
export const INSIGHT_LATE_HOUR_START = 23
export const INSIGHT_LATE_HOUR_END = 4
/** Window the rate limiter counts over. */
export const GOAL_PLAN_WINDOW_MS = 60 * 60 * 1000
export const GOAL_INPUT_MAX = 300
/** Day offsets are 0 (today) through DAY_OFFSET_MAX. */
export const DAY_OFFSET_MAX = 13
/** End-of-day deadline, in the user's timezone. */
export const DEADLINE_END_OF_DAY_HOUR = 23
export const DEADLINE_END_OF_DAY_MINUTE = 59

/** Default IANA timezone until the user picks one. */
export const DEFAULT_TIMEZONE = 'America/Toronto'
/** How long the "+N" points animation stays mounted, in milliseconds. */
export const POINTS_DELTA_MS = 1200
/** Delay before writing to the live region so screen readers see the change. */
export const ANNOUNCER_DELAY_MS = 20

/** Stroke width on a filled coloring section. */
export const COLOUR_STROKE_FILLED = 2.5
/** Stroke width on an empty coloring section. */
export const COLOUR_STROKE_EMPTY = 1

const asHex = (n: number) => '#' + n.toString(16).padStart(6, '0').toUpperCase()

/**Palette shown in the colour picker. Hex values live here because the server.*/
export const COLOUR_PALETTE: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Terracotta', hex: asHex(0xe8845a) },
  { name: 'Sage', hex: asHex(0x6bae8f) },
  { name: 'Amber', hex: asHex(0xf2c46d) },
  { name: 'Lavender', hex: asHex(0xb5a1d4) },
  { name: 'Sky', hex: asHex(0x7fb2d4) },
  { name: 'Clay', hex: asHex(0xb8512a) },
]

/** Closed set of ledger reasons; mirrors docs/SCHEMA.sql. */
export const POINT_REASONS = {
  DAILY_VISIT: 'daily_visit',
  MOOD_CHECKIN: 'mood_checkin',
  RATE_DIFFICULTY: 'rate_difficulty',
  TASK_COMPLETE: 'task_complete',
  TASK_COMPLETE_ON_TIME: 'task_complete_on_time',
  COLOR_SECTION: 'color_section',
} as const

export type PointReason = (typeof POINT_REASONS)[keyof typeof POINT_REASONS]
