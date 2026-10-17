import { z } from 'zod'
import { ApiError, ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { planGoal } from '@/lib/goalPlan'
import { hitRateLimit } from '@/lib/rateLimit'
import {
  GOAL_INPUT_MAX,
  GOAL_PLAN_MAX_PER_HOUR,
  GOAL_PLAN_WINDOW_MS,
} from '@/config/constants'
import { copy, fill } from '@/content/en'

const bodySchema = z
  .object({
    goal: z
      .string()
      .trim()
      .min(1, copy.planner.goalRequired)
      .max(GOAL_INPUT_MAX, fill(copy.planner.goalTooLong, { max: GOAL_INPUT_MAX })),
  })
  .strict()

export const POST = withRoute('POST /api/goals/plan', async (req, _ctx, requestId) => {
  const userId = await requireUser()
  const raw: unknown = await req.json().catch(() => ({}))
  const { goal } = bodySchema.parse(raw)

  const limit = hitRateLimit(
    userId,
    GOAL_PLAN_MAX_PER_HOUR,
    GOAL_PLAN_WINDOW_MS,
  )
  if (!limit.ok) {
    throw new ApiError('RATE_LIMITED', copy.errors.RATE_LIMITED, {
      retryAfterMs: limit.retryAfterMs,
    })
  }

  const plan = await planGoal(goal, requestId)
  return ok({ plan }, requestId)
})
