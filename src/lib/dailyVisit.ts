import { sql } from '@/lib/db'
import { ensureProfile, getProfile } from '@/lib/queries/profile'
import { todayFor } from '@/lib/queries/day'
import { awardPointsTx } from '@/lib/points'
import { daysBetween, nextStreak, toYMD } from '@/lib/streak'
import { logger } from '@/lib/logger'
import {
  DEFAULT_TIMEZONE,
  POINTS_DAILY_VISIT,
  POINT_REASONS,
  STREAK_GRACE_DAYS,
} from '@/config/constants'
import type { Profile } from '@/types'

export async function runDailyVisit(
  userId: string,
  timezone: string = DEFAULT_TIMEZONE,
): Promise<{ profile: Profile; visitAwarded: boolean; streakGraceUsed: boolean }> {
  const result = await sql.begin(async (tx) => {
    const profile = await ensureProfile(userId, timezone, tx)
    const today = todayFor(profile.timezone)

    const previousStreakYMD = toYMD(profile.last_streak_day)
    const preGap = previousStreakYMD
      ? daysBetween(previousStreakYMD, today)
      : null
    const streakGraceUsed =
      !profile.streak_paused &&
      preGap !== null &&
      preGap > 1 &&
      preGap <= STREAK_GRACE_DAYS
    if (!profile.streak_paused) {
      const streak = nextStreak(profile.streak_count, previousStreakYMD, today)
      await tx`
        update profiles
        set streak_count = ${streak},
            last_streak_day = ${today}
        where user_id = ${userId}
      `
    }

    const [row] = await tx<{ user_id: string }[]>`
      update profiles
      set last_visit_day = ${today}
      where user_id = ${userId}
        and (last_visit_day is null or last_visit_day < ${today})
      returning user_id
    `

    if (!row) {
      const fresh = await getProfile(userId, tx)
      if (!fresh) throw new Error('runDailyVisit: profile vanished mid-transaction')
      return { profile: fresh, visitAwarded: false, streakGraceUsed }
    }

    const newTotal = await awardPointsTx(
      tx,
      userId,
      POINTS_DAILY_VISIT,
      POINT_REASONS.DAILY_VISIT,
    )
    const fresh = await getProfile(userId, tx)
    if (!fresh) throw new Error('runDailyVisit: profile vanished mid-transaction')
    return {
      profile: { ...fresh, points_total: newTotal },
      visitAwarded: true,
      streakGraceUsed,
    }
  })

  if (result.visitAwarded) {
    logger.info({
      event: 'points_award',
      userId,
      amount: POINTS_DAILY_VISIT,
      reason: POINT_REASONS.DAILY_VISIT,
      total: result.profile.points_total,
    })
  }

  return result
}
