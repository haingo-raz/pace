import { sql } from '@/lib/db'
import { ensureProfile, getProfile } from '@/lib/queries/profile'
import { todayFor } from '@/lib/queries/day'
import { awardPointsTx } from '@/lib/points'
import { logger } from '@/lib/logger'
import {
  DEFAULT_TIMEZONE,
  POINTS_DAILY_VISIT,
  POINT_REASONS,
} from '@/config/constants'
import type { Profile } from '@/types'

export async function runDailyVisit(
  userId: string,
  timezone: string = DEFAULT_TIMEZONE,
): Promise<{ profile: Profile; visitAwarded: boolean }> {
  const result = await sql.begin(async (tx) => {
    const profile = await ensureProfile(userId, timezone, tx)
    const today = todayFor(profile.timezone)

    const [row] = await tx<{ user_id: string }[]>`
      update profiles
      set last_visit_day = ${today}
      where user_id = ${userId}
        and (last_visit_day is null or last_visit_day < ${today})
      returning user_id
    `

    if (!row) {
      return { profile, visitAwarded: false }
    }

    const newTotal = await awardPointsTx(
      tx,
      userId,
      POINTS_DAILY_VISIT,
      POINT_REASONS.DAILY_VISIT,
    )
    const fresh = await getProfile(userId, tx)
    if (!fresh) throw new Error('runDailyVisit: profile vanished mid-transaction')
    return { profile: { ...fresh, points_total: newTotal }, visitAwarded: true }
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
