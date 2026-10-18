import { ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { loadInsight } from '@/lib/insightLoader'
import { todayFor } from '@/lib/queries/day'
import { getProfile } from '@/lib/queries/profile'
import { DEFAULT_TIMEZONE } from '@/config/constants'

export const GET = withRoute('GET /api/insight', async (_req, _ctx, requestId) => {
  const userId = await requireUser()
  const profile = await getProfile(userId)
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE
  const today = todayFor(timezone)
  const payload = await loadInsight(
    userId,
    timezone,
    today,
    profile?.streak_count ?? 0,
    requestId,
  )
  return ok(payload, requestId)
})
