import { z } from 'zod'
import { ApiError, ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { sql } from '@/lib/db'
import {
  completeTask,
  deleteTask,
  rateTask,
} from '@/lib/queries/tasks'
import { awardPointsTx } from '@/lib/points'
import { logger } from '@/lib/logger'
import {
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  POINTS_RATE_DIFFICULTY,
  POINTS_TASK_COMPLETE,
  POINTS_TASK_ON_TIME,
  POINT_REASONS,
} from '@/config/constants'
import type { Difficulty } from '@/types'

const patchSchema = z
  .discriminatedUnion('action', [
    z.object({ action: z.literal('complete') }).strict(),
    z
      .object({
        action: z.literal('rate'),
        difficulty: z.number().int().min(DIFFICULTY_MIN).max(DIFFICULTY_MAX),
      })
      .strict(),
  ])

type Params = { id: string }

const paramsSchema = z.object({ id: z.string().uuid() })

export const PATCH = withRoute<{ params: Promise<Params> }>(
  'PATCH /api/tasks/[id]',
  async (req, ctx, requestId) => {
    const userId = await requireUser()
    const { id: taskId } = paramsSchema.parse(await ctx.params)
    const raw: unknown = await req.json().catch(() => ({}))
    const parsed = patchSchema.parse(raw)

    const result = await sql.begin(async (tx) => {
      if (parsed.action === 'complete') {
        const task = await completeTask(
          userId,
          taskId,
          POINTS_TASK_ON_TIME,
          POINTS_TASK_COMPLETE,
          tx,
        )
        if (!task) throw new ApiError('NOT_FOUND', 'Task not found.')
        const amount = task.points_earned
        const reason =
          amount === POINTS_TASK_ON_TIME
            ? POINT_REASONS.TASK_COMPLETE_ON_TIME
            : POINT_REASONS.TASK_COMPLETE
        const pointsTotal = await awardPointsTx(tx, userId, amount, reason)
        return { task, pointsAwarded: amount, reason, pointsTotal }
      }

      const rated = await rateTask(
        userId,
        taskId,
        parsed.difficulty as Difficulty,
        tx,
      )
      if (!rated) throw new ApiError('NOT_FOUND', 'Task not found.')
      if (!rated.firstRating) {
        return {
          task: rated.task,
          pointsAwarded: 0,
          reason: null,
          pointsTotal: null,
        }
      }
      const pointsTotal = await awardPointsTx(
        tx,
        userId,
        POINTS_RATE_DIFFICULTY,
        POINT_REASONS.RATE_DIFFICULTY,
      )
      return {
        task: rated.task,
        pointsAwarded: POINTS_RATE_DIFFICULTY,
        reason: POINT_REASONS.RATE_DIFFICULTY,
        pointsTotal,
      }
    })

    if (result.pointsAwarded > 0 && result.reason) {
      logger.info({
        event: 'points_award',
        userId,
        amount: result.pointsAwarded,
        reason: result.reason,
        total: result.pointsTotal,
      })
    }

    return ok(
      {
        task: result.task,
        pointsAwarded: result.pointsAwarded,
        pointsTotal: result.pointsTotal,
      },
      requestId,
    )
  },
)

export const DELETE = withRoute<{ params: Promise<Params> }>(
  'DELETE /api/tasks/[id]',
  async (_req, ctx, requestId) => {
    const userId = await requireUser()
    const { id: taskId } = paramsSchema.parse(await ctx.params)
    const removed = await deleteTask(userId, taskId)
    if (!removed) throw new ApiError('NOT_FOUND', 'Task not found.')
    return ok({ id: taskId }, requestId)
  },
)
