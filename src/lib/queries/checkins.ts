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
