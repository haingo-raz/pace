import type { Sql, TransactionSql } from 'postgres'
import { sql } from '@/lib/db'
import {
  INSIGHT_HALF_WINDOW_DAYS,
  INSIGHT_LATE_HOUR_END,
  INSIGHT_LATE_HOUR_START,
  INSIGHT_UNRATED_EFFORT,
  INSIGHT_WINDOW_DAYS,
  MS_PER_DAY,
  POINT_REASONS,
} from '@/config/constants'

function shiftDays(ymd: string, delta: number): string {
  const base = new Date(`${ymd}T00:00:00Z`).getTime()
  return new Date(base + delta * MS_PER_DAY).toISOString().slice(0, 10)
}

type Db = Sql | TransactionSql

export type InsightDayRow = {
  day: string
  mood: number | null
  effort: number
  late_events: number
}

export type InsightSeries = {
  rows: InsightDayRow[]
  deadlinesMissed: number
  pointsLast7: number
  sectionsLast7: number
}

type RawRow = {
  day: Date | string
  mood: number | null
  effort: number
  late_events: number
}

function toYMD(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

export async function getInsightSeries(
  userId: string,
  timezone: string,
  today: string,
  tx: Db = sql,
): Promise<InsightSeries> {
  const startYMD = shiftDays(today, -(INSIGHT_WINDOW_DAYS - 1))
  const endExclusiveYMD = shiftDays(today, 1)
  const [rowsResult, metaResult] = await Promise.all([
    tx<RawRow[]>`
      with days as (
        select (${startYMD}::date + gs)::date as day
        from generate_series(0, ${INSIGHT_WINDOW_DAYS - 1}::int) as gs
      ),
      moods as (
        select day, mood_score::int as mood
        from checkins
        where user_id = ${userId}
          and day >= ${startYMD}::date
          and day <= ${today}::date
      ),
      effort as (
        select (completed_at at time zone ${timezone})::date as day,
               sum(coalesce(difficulty, ${INSIGHT_UNRATED_EFFORT}))::int as effort
        from tasks
        where user_id = ${userId}
          and completed_at is not null
          and (completed_at at time zone ${timezone})::date >= ${startYMD}::date
          and (completed_at at time zone ${timezone})::date <= ${today}::date
        group by 1
      ),
      late as (
        select (time at time zone ${timezone})::date as day,
               count(*)::int as late_events
        from points_log
        where user_id = ${userId}
          and time >= ${startYMD}::timestamp
          and time < ${endExclusiveYMD}::timestamp
          and (
            extract(hour from (time at time zone ${timezone})) >= ${INSIGHT_LATE_HOUR_START}
            or extract(hour from (time at time zone ${timezone})) < ${INSIGHT_LATE_HOUR_END}
          )
        group by 1
      )
      select d.day,
             m.mood,
             coalesce(e.effort, 0) as effort,
             coalesce(l.late_events, 0) as late_events
      from days d
      left join moods m  on m.day = d.day
      left join effort e on e.day = d.day
      left join late l   on l.day = d.day
      order by d.day asc
    `,
    tx<
      {
        deadlines_missed: number
        points_last7: number
        sections_last7: number
      }[]
    >`
      with d as (
        select count(*)::int as deadlines_missed
        from tasks
        where user_id = ${userId}
          and deadline is not null
          and deadline < now()
          and (completed_at is null or completed_at > deadline)
          and deadline >= now() - (${INSIGHT_WINDOW_DAYS} * interval '1 day')
      ),
      p as (
        select coalesce(sum(amount), 0)::int as points_last7
        from points_log
        where user_id = ${userId}
          and amount > 0
          and time >= now() - (${INSIGHT_HALF_WINDOW_DAYS} * interval '1 day')
      ),
      s as (
        select count(*)::int as sections_last7
        from points_log
        where user_id = ${userId}
          and reason = ${POINT_REASONS.COLOR_SECTION}
          and time >= now() - (${INSIGHT_HALF_WINDOW_DAYS} * interval '1 day')
      )
      select d.deadlines_missed, p.points_last7, s.sections_last7
      from d, p, s
    `,
  ])

  const rows: InsightDayRow[] = rowsResult.map((r) => ({
    day: toYMD(r.day),
    mood: r.mood,
    effort: Number(r.effort),
    late_events: Number(r.late_events),
  }))
  const meta = metaResult[0] ?? {
    deadlines_missed: 0,
    points_last7: 0,
    sections_last7: 0,
  }
  return {
    rows,
    deadlinesMissed: Number(meta.deadlines_missed),
    pointsLast7: Number(meta.points_last7),
    sectionsLast7: Number(meta.sections_last7),
  }
}

export async function hasDismissedToday(
  userId: string,
  pattern: string,
  today: string,
  tx: Db = sql,
): Promise<boolean> {
  const [row] = await tx<{ exists: boolean }[]>`
    select exists(
      select 1 from insight_dismissals
      where user_id = ${userId} and pattern = ${pattern} and day = ${today}
    ) as exists
  `
  return !!row?.exists
}

export async function getTodayTotals(
  userId: string,
  timezone: string,
  today: string,
  tx: Db = sql,
): Promise<{ pointsToday: number; tasksDoneToday: number }> {
  const [row] = await tx<
    { points_today: number; tasks_done_today: number }[]
  >`
    with p as (
      select coalesce(sum(amount), 0)::int as points_today
      from points_log
      where user_id = ${userId}
        and amount > 0
        and (time at time zone ${timezone})::date = ${today}::date
    ),
    t as (
      select count(*)::int as tasks_done_today
      from tasks
      where user_id = ${userId}
        and completed_at is not null
        and (completed_at at time zone ${timezone})::date = ${today}::date
    )
    select p.points_today, t.tasks_done_today
    from p, t
  `
  return {
    pointsToday: Number(row?.points_today ?? 0),
    tasksDoneToday: Number(row?.tasks_done_today ?? 0),
  }
}

export async function dismissInsight(
  userId: string,
  pattern: string,
  today: string,
  tx: Db = sql,
): Promise<void> {
  await tx`
    insert into insight_dismissals (user_id, pattern, day)
    values (${userId}, ${pattern}, ${today})
    on conflict (user_id, pattern, day) do nothing
  `
}
