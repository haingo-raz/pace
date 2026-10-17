import { sql } from '@/lib/db'
import { MS_PER_DAY } from '@/config/constants'

export type DayPoint = { day: string; value: number | null }

export type StatsPayload = {
  mood: DayPoint[]
  points: DayPoint[]
  weeklyAvgMood: number | null
  totals: {
    pointsInRange: number
    checkinsInRange: number
  }
}

function shiftDays(ymd: string, delta: number): string {
  const base = new Date(`${ymd}T00:00:00Z`).getTime()
  return new Date(base + delta * MS_PER_DAY).toISOString().slice(0, 10)
}

function toYMD(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

/**
 * Reads the points_daily continuous aggregate. Buckets are
 * on timestamptz, so points land in the user's local day via `at time zone`.
 * Days with no activity become 0 via the generate_series left-join, and a net
 * loss on a day (coloring spends) is clamped to 0 so the bar chart stays
 * non-negative. Note: the aggregate's hourly refresh means events from the
 * last ~hour may not appear; applying
 *   ALTER MATERIALIZED VIEW points_daily SET (timescaledb.materialized_only = false);
 * enables real-time reads so today's events show immediately.
 */
async function getPointsSeries(
  userId: string,
  timezone: string,
  startYMD: string,
  days: number,
): Promise<DayPoint[]> {
  const rows = await sql<{ day: Date | string; value: number }[]>`
    with d as (
      select (${startYMD}::date + gs)::date as day
      from generate_series(0, ${days - 1}::int) as gs
    )
    select d.day,
           coalesce(greatest(p.points, 0), 0)::int as value
    from d
    left join points_daily p
      on (p.day at time zone ${timezone})::date = d.day
     and p.user_id = ${userId}
    order by d.day asc
  `
  return rows.map((r) => ({ day: toYMD(r.day), value: Number(r.value) }))
}

/**
 * Reads daily mood from the raw checkins table (there is no mood_daily
 * aggregate available, only mood_weekly). Days without a check-in get null so the
 * line chart draws a gap rather than claiming mood 0.
 */
async function getMoodSeries(
  userId: string,
  startYMD: string,
  days: number,
): Promise<DayPoint[]> {
  const rows = await sql<
    { day: Date | string; value: number | null }[]
  >`
    with d as (
      select (${startYMD}::date + gs)::date as day
      from generate_series(0, ${days - 1}::int) as gs
    )
    select d.day,
           c.mood_score::int as value
    from d
    left join checkins c
      on c.day = d.day and c.user_id = ${userId}
    order by d.day asc
  `
  return rows.map((r) => ({
    day: toYMD(r.day),
    value: r.value === null ? null : Number(r.value),
  }))
}

/**
 * Reads the mood_weekly continuous aggregate for the most recent week.
 */
async function getWeeklyAvgMood(userId: string): Promise<number | null> {
  const [row] = await sql<{ avg_mood: string | number | null }[]>`
    select avg_mood
    from mood_weekly
    where user_id = ${userId}
    order by week desc
    limit 1
  `
  const v = row?.avg_mood
  if (v === null || v === undefined) return null
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

export async function getStats(
  userId: string,
  timezone: string,
  today: string,
  days: number,
): Promise<StatsPayload> {
  const startYMD = shiftDays(today, -(days - 1))
  const [points, mood, weeklyAvgMood] = await Promise.all([
    getPointsSeries(userId, timezone, startYMD, days),
    getMoodSeries(userId, startYMD, days),
    getWeeklyAvgMood(userId),
  ])

  const pointsInRange = points.reduce((acc, p) => acc + (p.value ?? 0), 0)
  const checkinsInRange = mood.reduce(
    (acc, m) => acc + (m.value === null ? 0 : 1),
    0,
  )

  return {
    mood,
    points,
    weeklyAvgMood,
    totals: { pointsInRange, checkinsInRange },
  }
}
