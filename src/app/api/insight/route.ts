import { z } from 'zod'
import { ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { loadInsight } from '@/lib/insightLoader'
import { dismissInsight } from '@/lib/queries/insights'
import { todayFor } from '@/lib/queries/day'
import { getProfile } from '@/lib/queries/profile'
import { DEFAULT_TIMEZONE } from '@/config/constants'

const DISMISSABLE_KINDS = [
  'GRINDING',
  'SUSTAINED_LOW',
  'EFFORT_CLIMBING',
  'DEADLINES_SLIP',
  'NOT_RECOVERING',
  'LATE_NIGHTS',
  'RECOVERING',
] as const

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

const bodySchema = z
  .object({
    pattern: z.enum(DISMISSABLE_KINDS),
  })
  .strict()

export const POST = withRoute('POST /api/insight', async (req, _ctx, requestId) => {
  const userId = await requireUser()
  const raw: unknown = await req.json().catch(() => ({}))
  const { pattern } = bodySchema.parse(raw)

  const profile = await getProfile(userId)
  const today = todayFor(profile?.timezone ?? DEFAULT_TIMEZONE)
  await dismissInsight(userId, pattern, today)

  return ok({ dismissed: true }, requestId)
})
