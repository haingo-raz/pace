import { z } from 'zod'
import { ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import {
  getProfile,
  markOnboarded,
  resetOnboarding,
} from '@/lib/queries/profile'

const postSchema = z
  .object({
    skipped: z.boolean(),
    replay: z.boolean().optional(),
  })
  .strict()

export const GET = withRoute(
  'GET /api/me/onboarding',
  async (_req, _ctx, requestId) => {
    const userId = await requireUser()
    const profile = await getProfile(userId)
    const needsOnboarding = !profile?.onboarded_at
    return ok({ needsOnboarding }, requestId)
  },
)

export const POST = withRoute(
  'POST /api/me/onboarding',
  async (req, _ctx, requestId) => {
    const userId = await requireUser()
    const raw: unknown = await req.json().catch(() => ({}))
    const { replay } = postSchema.parse(raw)

    if (replay) {
      await resetOnboarding(userId)
      return ok({ onboarded_at: null }, requestId)
    }
    const onboarded_at = await markOnboarded(userId)
    return ok({ onboarded_at }, requestId)
  },
)
