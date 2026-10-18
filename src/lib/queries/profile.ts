import type { Sql, TransactionSql } from 'postgres'
import { sql } from '@/lib/db'
import type { EmploymentStatus, Profile } from '@/types'

type Db = Sql | TransactionSql

const UNDEFINED_COLUMN = '42703'

export async function getProfile(
  userId: string,
  tx: Db = sql,
): Promise<Profile | null> {
  try {
    const [row] = await tx<Profile[]>`
      select user_id, points_total, streak_count, last_visit_day,
             last_streak_day, timezone, streak_paused,
             employment_status, preferred_name, onboarded_at, created_at
      from profiles
      where user_id = ${userId}
    `
    return row ?? null
  } catch (e) {
    if ((e as { code?: string }).code !== UNDEFINED_COLUMN) throw e
    const [row] = await tx<
      Array<Omit<Profile, 'employment_status' | 'preferred_name' | 'onboarded_at'>>
    >`
      select user_id, points_total, streak_count, last_visit_day,
             last_streak_day, timezone, streak_paused, created_at
      from profiles
      where user_id = ${userId}
    `
    return row
      ? {
          ...row,
          employment_status: null,
          preferred_name: null,
          onboarded_at: null,
        }
      : null
  }
}

/**
 * Marks the user as having seen the onboarding tour (or skipped it).
 * Idempotent: the field only moves from null to a timestamp once. A
 * second call keeps the original timestamp.
 */
export async function markOnboarded(
  userId: string,
  tx: Db = sql,
): Promise<string | null> {
  try {
    const [row] = await tx<{ onboarded_at: Date | null }[]>`
      update profiles
      set onboarded_at = coalesce(onboarded_at, now())
      where user_id = ${userId}
      returning onboarded_at
    `
    return row?.onboarded_at ? row.onboarded_at.toISOString() : null
  } catch (e) {
    if ((e as { code?: string }).code === UNDEFINED_COLUMN) return null
    throw e
  }
}

/**
 * Clears the onboarding timestamp so the tour fires again on next load.
 * Used by Settings -> Replay tour.
 */
export async function resetOnboarding(
  userId: string,
  tx: Db = sql,
): Promise<void> {
  try {
    await tx`
      update profiles
      set onboarded_at = null
      where user_id = ${userId}
    `
  } catch (e) {
    if ((e as { code?: string }).code === UNDEFINED_COLUMN) return
    throw e
  }
}

export async function updateProfilePersonalization(
  userId: string,
  patch: { employment_status?: EmploymentStatus | null; preferred_name?: string | null },
  tx: Db = sql,
): Promise<Profile | null> {
  await tx`
    update profiles
    set employment_status = case when ${patch.employment_status !== undefined}::boolean
                                 then ${patch.employment_status ?? null}::text
                                 else employment_status end,
        preferred_name    = case when ${patch.preferred_name !== undefined}::boolean
                                 then ${patch.preferred_name ?? null}::text
                                 else preferred_name end
    where user_id = ${userId}
  `
  return getProfile(userId, tx)
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
