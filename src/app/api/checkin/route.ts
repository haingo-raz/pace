import { z } from 'zod'
import { ApiError, ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { sql } from '@/lib/db'
import { ensureProfile, getProfile } from '@/lib/queries/profile'
import { insertCheckin, updateTodayMood } from '@/lib/queries/checkins'
import { todayFor } from '@/lib/queries/day'
import { awardPointsTx } from '@/lib/points'
import { logger } from '@/lib/logger'
import {
  DEFAULT_TIMEZONE,
  POINTS_MOOD_CHECKIN,
  POINT_REASONS,
} from '@/config/constants'

const bodySchema = z
  .object({
    mood: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  })
  .strict()

export const POST = withRoute(
  'POST /api/checkin',
  async (req, _ctx, requestId) => {
    const userId = await requireUser()
    const raw: unknown = await req.json().catch(() => ({}))
    const { mood } = bodySchema.parse(raw)

    const pointsTotal = await sql.begin(async (tx) => {
      const profile = await ensureProfile(userId, DEFAULT_TIMEZONE, tx)
      const today = todayFor(profile.timezone)

      const insertedDay = await insertCheckin(tx, userId, today, mood)
      if (!insertedDay) {
        throw new ApiError('CONFLICT', 'You have already checked in today.')
      }

      return awardPointsTx(
        tx,
        userId,
        POINTS_MOOD_CHECKIN,
        POINT_REASONS.MOOD_CHECKIN,
      )
    })

    logger.info({
      event: 'points_award',
      userId,
      amount: POINTS_MOOD_CHECKIN,
      reason: POINT_REASONS.MOOD_CHECKIN,
      total: pointsTotal,
    })

    return ok(
      { pointsAwarded: POINTS_MOOD_CHECKIN, pointsTotal },
      requestId,
    )
  },
)

export const PATCH = withRoute(
  'PATCH /api/checkin',
  async (req, _ctx, requestId) => {
    const userId = await requireUser()
    const raw: unknown = await req.json().catch(() => ({}))
    const { mood } = bodySchema.parse(raw)

    const profile = await getProfile(userId)
    const today = todayFor(profile?.timezone ?? DEFAULT_TIMEZONE)
    const updated = await updateTodayMood(userId, today, mood)
    if (!updated) {
      throw new ApiError('NOT_FOUND', 'No check-in to update today.')
    }
    return ok({ mood: updated.mood_score }, requestId)
  },
)
