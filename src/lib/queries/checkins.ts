import type { Sql, TransactionSql } from 'postgres'
import { sql } from '@/lib/db'
import type { Checkin, MoodScore } from '@/types'

type Db = Sql | TransactionSql

export async function getTodayCheckin(
  userId: string,
  today: string,
  tx: Db = sql,
): Promise<Checkin | null> {
  const [row] = await tx<Checkin[]>`
    select day, user_id, mood_score, created_at
    from checkins
    where user_id = ${userId} and day = ${today}
  `
  return row ?? null
}

/**
 * Updates mood_score for today's row. Returns the updated row, or null when
 * no row exists for today (the caller translates null to NOT_FOUND).
 * No points are awarded as the +10 already fired on the original check-in.
 */
export async function updateTodayMood(
  userId: string,
  today: string,
  mood: MoodScore,
  tx: Db = sql,
): Promise<Checkin | null> {
  const [row] = await tx<Checkin[]>`
    update checkins
    set mood_score = ${mood}
    where user_id = ${userId} and day = ${today}
    returning day, user_id, mood_score, created_at
  `
  return row ?? null
}

/**
 * Insert on conflict do nothing. Returns the day when inserted, or null when
 * the user had already checked in today. The caller decides what to do.
 */
export async function insertCheckin(
  tx: Db,
  userId: string,
  today: string,
  mood: MoodScore,
): Promise<string | null> {
  const [row] = await tx<{ day: string }[]>`
    insert into checkins (day, user_id, mood_score)
    values (${today}, ${userId}, ${mood})
    on conflict (user_id, day) do nothing
    returning day
  `
  return row?.day ?? null
}
