import { z } from 'zod'
import { ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getStats } from '@/lib/queries/stats'
import { getProfile } from '@/lib/queries/profile'
import { todayFor } from '@/lib/queries/day'
import {
  DEFAULT_TIMEZONE,
  STATS_DAYS_DEFAULT,
  STATS_DAYS_MAX,
  STATS_DAYS_MIN,
} from '@/config/constants'

const querySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .catch(STATS_DAYS_DEFAULT)
    .transform((n) =>
      Math.max(STATS_DAYS_MIN, Math.min(STATS_DAYS_MAX, n)),
    ),
})

export const GET = withRoute('GET /api/stats', async (req, _ctx, requestId) => {
  const userId = await requireUser()
  const url = new URL(req.url)
  const { days } = querySchema.parse({
    days: url.searchParams.get('days') ?? String(STATS_DAYS_DEFAULT),
  })

  const profile = await getProfile(userId)
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE
  const today = todayFor(timezone)
  const stats = await getStats(userId, timezone, today, days)
  return ok(stats, requestId)
})
