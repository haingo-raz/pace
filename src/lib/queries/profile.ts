import type { Sql, TransactionSql } from 'postgres'
import { sql } from '@/lib/db'
import type { Profile } from '@/types'

type Db = Sql | TransactionSql

export async function getProfile(
  userId: string,
  tx: Db = sql,
): Promise<Profile | null> {
  const [row] = await tx<Profile[]>`
    select user_id, points_total, streak_count, last_visit_day,
           last_streak_day, timezone, streak_paused, created_at
    from profiles
    where user_id = ${userId}
  `
  return row ?? null
}

export async function setStreakPaused(
  userId: string,
  paused: boolean,
  today: string,
  tx: Db = sql,
): Promise<Profile | null> {
  await tx`
    update profiles
    set streak_paused = ${paused},
        last_streak_day = case when ${paused}::boolean = false
                               then ${today}::date
                               else last_streak_day end
    where user_id = ${userId}
  `
  return getProfile(userId, tx)
}

export async function ensureProfile(
  userId: string,
  timezone: string,
  tx: Db = sql,
): Promise<Profile> {
  await tx`
    insert into profiles (user_id, timezone)
    values (${userId}, ${timezone})
    on conflict (user_id) do nothing
  `
  const profile = await getProfile(userId, tx)
  if (!profile) {
    throw new Error('ensureProfile: insert succeeded but select returned nothing')
  }
  return profile
}
