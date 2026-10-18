import { z } from 'zod'
import { ApiError, ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { sql } from '@/lib/db'
import {
  insertTask,
  listActiveTasks,
  listDoneTasks,
} from '@/lib/queries/tasks'
import { groupBelongsToUser, listGroups } from '@/lib/queries/taskGroups'
import { awardPointsTx } from '@/lib/points'
import { logger } from '@/lib/logger'
import {
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  DONE_TASKS_LIMIT,
  POINTS_RATE_DIFFICULTY,
  POINT_REASONS,
  TASK_TITLE_MAX,
} from '@/config/constants'
import { copy, fill } from '@/content/en'
import type { Difficulty } from '@/types'

export const GET = withRoute('GET /api/tasks', async (_req, _ctx, requestId) => {
  const userId = await requireUser()
  const [groups, active, done] = await Promise.all([
    listGroups(userId),
    listActiveTasks(userId),
    listDoneTasks(userId, DONE_TASKS_LIMIT),
  ])
  return ok(
    { groups, active, done: done.tasks, doneTruncated: done.truncated },
    requestId,
  )
})

const bodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, copy.tasks.titleRequired)
      .max(TASK_TITLE_MAX, fill(copy.tasks.titleTooLong, { max: TASK_TITLE_MAX })),
    difficulty: z
      .number()
      .int()
      .min(DIFFICULTY_MIN)
      .max(DIFFICULTY_MAX)
      .nullable(),
    deadline: z.string().datetime().nullable(),
    groupId: z.string().uuid().nullable().default(null),
  })
  .strict()

export const POST = withRoute('POST /api/tasks', async (req, _ctx, requestId) => {
  const userId = await requireUser()
  const raw: unknown = await req.json().catch(() => ({}))
  const { title, difficulty, deadline, groupId } = bodySchema.parse(raw)

  if (groupId !== null) {
    const owned = await groupBelongsToUser(userId, groupId)
    if (!owned) {
      throw new ApiError(
        'VALIDATION_ERROR',
        copy.errors.VALIDATION_ERROR,
        { fields: { groupId: copy.groups.unknownGroup } },
      )
    }
  }

  const result = await sql.begin(async (tx) => {
    const task = await insertTask(
      userId,
      title,
      difficulty as Difficulty | null,
      deadline,
      groupId,
      tx,
    )
    if (difficulty !== null) {
      const pointsTotal = await awardPointsTx(
        tx,
        userId,
        POINTS_RATE_DIFFICULTY,
        POINT_REASONS.RATE_DIFFICULTY,
      )
      return { task, pointsAwarded: POINTS_RATE_DIFFICULTY, pointsTotal }
    }
    return { task, pointsAwarded: 0, pointsTotal: null as number | null }
  })

  if (result.pointsAwarded > 0) {
    logger.info({
      event: 'points_award',
      userId,
      amount: result.pointsAwarded,
      reason: POINT_REASONS.RATE_DIFFICULTY,
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
})
