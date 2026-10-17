import { requireUser } from '@/lib/auth'
import { ok, withRoute } from '@/lib/api'
import { runDailyVisit } from '@/lib/dailyVisit'

export const GET = withRoute('GET /api/me', async (_req, _ctx, requestId) => {
  const userId = await requireUser()
  const { profile, visitAwarded } = await runDailyVisit(userId)
  return ok({ profile, visitAwarded }, requestId)
})
