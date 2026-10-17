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
export const SECTION_ID_MAX = 64

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
