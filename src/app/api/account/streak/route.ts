import { z } from 'zod'
import { ApiError, ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getProfile, setStreakPaused } from '@/lib/queries/profile'
import { todayFor } from '@/lib/queries/day'
import { DEFAULT_TIMEZONE } from '@/config/constants'

const bodySchema = z.object({ paused: z.boolean() }).strict()

export const POST = withRoute('POST /api/account/streak', async (req, _ctx, requestId) => {
  const userId = await requireUser()
  const raw: unknown = await req.json().catch(() => ({}))
  const { paused } = bodySchema.parse(raw)
  const existing = await getProfile(userId)
  if (!existing) throw new ApiError('NOT_FOUND', 'Profile not found.')
  const timezone = existing.timezone || DEFAULT_TIMEZONE
  const profile = await setStreakPaused(userId, paused, todayFor(timezone))
  if (!profile) throw new ApiError('NOT_FOUND', 'Profile not found.')
  return ok({ profile }, requestId)
})
