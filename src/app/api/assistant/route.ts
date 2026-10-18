import { z } from 'zod'
import { ApiError, ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { sql } from '@/lib/db'
import { getProfile } from '@/lib/queries/profile'
import { getTodayCheckin } from '@/lib/queries/checkins'
import { todayFor } from '@/lib/queries/day'
import {
  completeTask,
  deleteTask,
  editTask,
  insertTask,
  listActiveTasks,
  listDoneTasks,
  uncompleteTask,
} from '@/lib/queries/tasks'
import { listGroups } from '@/lib/queries/taskGroups'
import { awardPointsTx } from '@/lib/points'
import { hitRateLimit } from '@/lib/rateLimit'
import {
  classifyIntent,
  matchGroupByName,
  matchTaskByTitle,
  type Intent,
} from '@/lib/assistant'
import { logger } from '@/lib/logger'
import {
  DEFAULT_TIMEZONE,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  DONE_TASKS_LIMIT,
  POINTS_TASK_COMPLETE,
  POINTS_TASK_ON_TIME,
  POINT_REASONS,
  TASK_TITLE_MAX,
} from '@/config/constants'
import { copy, fill } from '@/content/en'
import type { AssistantReply, Difficulty } from '@/types'

const ASSISTANT_MAX_PER_HOUR = 30
const ASSISTANT_WINDOW_MS = 60 * 60 * 1000
const ASSISTANT_INPUT_MAX = 500
const ASSISTANT_HISTORY_MAX = 8

const historyItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().trim().min(1).max(ASSISTANT_INPUT_MAX),
})

const bodySchema = z
  .object({
    message: z.string().trim().min(1).max(ASSISTANT_INPUT_MAX),
    history: z
      .array(historyItemSchema)
      .max(ASSISTANT_HISTORY_MAX)
      .optional(),
  })
  .strict()

function reply(r: AssistantReply): AssistantReply {
  return r
}

function coerceDifficulty(value: number | null | undefined): Difficulty | null {
  if (value === null || value === undefined) return null
  if (!Number.isInteger(value)) return null
  if (value < DIFFICULTY_MIN || value > DIFFICULTY_MAX) return null
  return value as Difficulty
}

export const POST = withRoute(
  'POST /api/assistant',
  async (req, _ctx, requestId) => {
    const userId = await requireUser()
    const raw: unknown = await req.json().catch(() => ({}))
    const { message, history } = bodySchema.parse(raw)

    const limit = hitRateLimit(
      `assistant:${userId}`,
      ASSISTANT_MAX_PER_HOUR,
      ASSISTANT_WINDOW_MS,
    )
    if (!limit.ok) {
      throw new ApiError('RATE_LIMITED', copy.assistant.rateLimited)
    }

    const profile = await getProfile(userId)
    const timezone = profile?.timezone ?? DEFAULT_TIMEZONE
    const today = todayFor(timezone)
    const checkin = await getTodayCheckin(userId, today)
    const [active, done, groups] = await Promise.all([
      listActiveTasks(userId),
      listDoneTasks(userId, DONE_TASKS_LIMIT),
      listGroups(userId),
    ])

    let intent: Intent
    try {
      intent = await classifyIntent(
        message,
        {
          activeTasks: active.map((t) => ({
            id: t.id,
            title: t.title,
            deadline: t.deadline,
          })),
          doneTasks: done.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            deadline: t.deadline,
          })),
          groups: groups.map((g) => ({ id: g.id, title: g.title })),
          history: history ?? [],
          preferredName: profile?.preferred_name ?? null,
          employmentStatus: profile?.employment_status ?? null,
          mood: checkin?.mood_score ?? null,
          timezone,
          nowIso: new Date().toISOString(),
        },
        requestId,
      )
    } catch {
      throw new ApiError('AI_UNAVAILABLE', copy.assistant.unavailable)
    }

    switch (intent.intent) {
      case 'qna': {
        const text =
          intent.answer?.trim() || copy.assistant.outOfScope
        return ok(reply({ kind: 'answer', text }), requestId)
      }

      case 'greeting': {
        const text =
          intent.answer?.trim() || copy.assistant.greetingFallback
        return ok(reply({ kind: 'answer', text }), requestId)
      }

      case 'out_of_scope': {
        return ok(
          reply({ kind: 'out_of_scope', text: copy.assistant.outOfScope }),
          requestId,
        )
      }

      case 'needs_info': {
        const text = intent.followUp?.trim() || copy.assistant.needsTitle
        return ok(reply({ kind: 'needs_info', text }), requestId)
      }

      case 'create_task': {
        if (!intent.create?.title) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsNewTitle }),
            requestId,
          )
        }
        const title = intent.create.title.trim().slice(0, TASK_TITLE_MAX)
        const difficulty = coerceDifficulty(intent.create.difficulty ?? null)
        const deadline = sanitiseIso(intent.create.deadlineIso ?? null)

        let groupId: string | null = null
        const requestedGroup = intent.create.groupName?.trim() ?? ''
        if (requestedGroup) {
          const g = matchGroupByName(requestedGroup, groups)
          if (g.kind === 'ambiguous') {
            return ok(
              reply({ kind: 'ambiguous', text: copy.assistant.groupAmbiguous }),
              requestId,
            )
          }
          if (g.kind === 'none') {
            return ok(
              reply({
                kind: 'no_match',
                text: fill(copy.assistant.groupNoMatch, {
                  name: requestedGroup,
                }),
              }),
              requestId,
            )
          }
          groupId = g.group.id
        }

        const task = await sql.begin(async (tx) => {
          const t = await insertTask(userId, title, difficulty, deadline, groupId, tx)
          return t
        })
        return ok(
          reply({
            kind: 'action_done',
            text: fill(copy.assistant.actionDone.created, { title: task.title }),
            task,
          }),
          requestId,
        )
      }

      case 'update_task_title': {
        if (!intent.taskMatch?.title) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsTitle }),
            requestId,
          )
        }
        if (!intent.newTitle) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsName }),
            requestId,
          )
        }
        const match = matchTaskByTitle(
          intent.taskMatch.title,
          [...active, ...done.tasks],
        )
        if (match.kind === 'none') {
          return ok(
            reply({ kind: 'no_match', text: copy.assistant.noMatch }),
            requestId,
          )
        }
        if (match.kind === 'ambiguous') {
          return ok(
            reply({ kind: 'ambiguous', text: copy.assistant.tooManyMatches }),
            requestId,
          )
        }
        const title = intent.newTitle.trim().slice(0, TASK_TITLE_MAX)
        const task = await editTask(userId, match.task.id, { title })
        if (!task) throw new ApiError('NOT_FOUND', 'Task not found.')
        return ok(
          reply({
            kind: 'action_done',
            text: fill(copy.assistant.actionDone.updated, { title: task.title }),
            task,
          }),
          requestId,
        )
      }

      case 'update_task_deadline': {
        if (!intent.taskMatch?.title) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsTitle }),
            requestId,
          )
        }
        const deadline = sanitiseIso(intent.deadlineIso ?? null)
        if (!deadline) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsDeadline }),
            requestId,
          )
        }
        const match = matchTaskByTitle(
          intent.taskMatch.title,
          [...active, ...done.tasks],
        )
        if (match.kind === 'none') {
          return ok(
            reply({ kind: 'no_match', text: copy.assistant.noMatch }),
            requestId,
          )
        }
        if (match.kind === 'ambiguous') {
          return ok(
            reply({ kind: 'ambiguous', text: copy.assistant.tooManyMatches }),
            requestId,
          )
        }
        const task = await editTask(userId, match.task.id, { deadline })
        if (!task) throw new ApiError('NOT_FOUND', 'Task not found.')
        return ok(
          reply({
            kind: 'action_done',
            text: fill(copy.assistant.actionDone.updated, { title: task.title }),
            task,
          }),
          requestId,
        )
      }

      case 'update_task_difficulty': {
        if (!intent.taskMatch?.title) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsTitle }),
            requestId,
          )
        }
        const difficulty = coerceDifficulty(intent.difficulty ?? null)
        if (difficulty === null) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsDifficulty }),
            requestId,
          )
        }
        const match = matchTaskByTitle(
          intent.taskMatch.title,
          [...active, ...done.tasks],
        )
        if (match.kind === 'none') {
          return ok(
            reply({ kind: 'no_match', text: copy.assistant.noMatch }),
            requestId,
          )
        }
        if (match.kind === 'ambiguous') {
          return ok(
            reply({ kind: 'ambiguous', text: copy.assistant.tooManyMatches }),
            requestId,
          )
        }
        const task = await editTask(userId, match.task.id, { difficulty })
        if (!task) throw new ApiError('NOT_FOUND', 'Task not found.')
        return ok(
          reply({
            kind: 'action_done',
            text: fill(copy.assistant.actionDone.updated, { title: task.title }),
            task,
          }),
          requestId,
        )
      }

      case 'update_task_group': {
        if (!intent.taskMatch?.title) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsTitle }),
            requestId,
          )
        }
        const rawGroup = intent.groupName
        const requestedGroup =
          typeof rawGroup === 'string' ? rawGroup.trim() : null
        if (requestedGroup === null) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsGroup }),
            requestId,
          )
        }
        let groupId: string | null = null
        let groupTitle = ''
        if (requestedGroup) {
          const g = matchGroupByName(requestedGroup, groups)
          if (g.kind === 'ambiguous') {
            return ok(
              reply({ kind: 'ambiguous', text: copy.assistant.groupAmbiguous }),
              requestId,
            )
          }
          if (g.kind === 'none') {
            return ok(
              reply({
                kind: 'no_match',
                text: fill(copy.assistant.groupNoMatch, {
                  name: requestedGroup,
                }),
              }),
              requestId,
            )
          }
          groupId = g.group.id
          groupTitle = g.group.title
        }
        const match = matchTaskByTitle(
          intent.taskMatch.title,
          [...active, ...done.tasks],
        )
        if (match.kind === 'none') {
          return ok(
            reply({ kind: 'no_match', text: copy.assistant.noMatch }),
            requestId,
          )
        }
        if (match.kind === 'ambiguous') {
          return ok(
            reply({ kind: 'ambiguous', text: copy.assistant.tooManyMatches }),
            requestId,
          )
        }
        const task = await editTask(userId, match.task.id, { groupId })
        if (!task) throw new ApiError('NOT_FOUND', 'Task not found.')
        const text =
          groupId === null
            ? fill(copy.assistant.actionDone.ungrouped, { title: task.title })
            : fill(copy.assistant.actionDone.moved, {
                title: task.title,
                group: groupTitle,
              })
        return ok(
          reply({ kind: 'action_done', text, task }),
          requestId,
        )
      }

      case 'complete_task': {
        if (!intent.taskMatch?.title) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsTitle }),
            requestId,
          )
        }
        const match = matchTaskByTitle(intent.taskMatch.title, active)
        if (match.kind === 'none') {
          return ok(
            reply({ kind: 'no_match', text: copy.assistant.noMatch }),
            requestId,
          )
        }
        if (match.kind === 'ambiguous') {
          return ok(
            reply({ kind: 'ambiguous', text: copy.assistant.tooManyMatches }),
            requestId,
          )
        }
        const result = await sql.begin(async (tx) => {
          const task = await completeTask(
            userId,
            match.task.id,
            POINTS_TASK_ON_TIME,
            POINTS_TASK_COMPLETE,
            tx,
          )
          if (!task) throw new ApiError('NOT_FOUND', 'Task not found.')
          const reason =
            task.points_earned === POINTS_TASK_ON_TIME
              ? POINT_REASONS.TASK_COMPLETE_ON_TIME
              : POINT_REASONS.TASK_COMPLETE
          await awardPointsTx(tx, userId, task.points_earned, reason)
          return task
        })
        logger.info({
          event: 'points_award',
          userId,
          amount: result.points_earned,
          reason: 'assistant_complete',
        })
        return ok(
          reply({
            kind: 'action_done',
            text: fill(copy.assistant.actionDone.completed, {
              title: result.title,
            }),
            task: result,
          }),
          requestId,
        )
      }

      case 'uncomplete_task': {
        if (!intent.taskMatch?.title) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsTitle }),
            requestId,
          )
        }
        const match = matchTaskByTitle(intent.taskMatch.title, done.tasks)
        if (match.kind === 'none') {
          return ok(
            reply({ kind: 'no_match', text: copy.assistant.noMatch }),
            requestId,
          )
        }
        if (match.kind === 'ambiguous') {
          return ok(
            reply({ kind: 'ambiguous', text: copy.assistant.tooManyMatches }),
            requestId,
          )
        }
        const task = await uncompleteTask(userId, match.task.id)
        if (!task) throw new ApiError('NOT_FOUND', 'Task not found.')
        return ok(
          reply({
            kind: 'action_done',
            text: fill(copy.assistant.actionDone.uncompleted, {
              title: task.title,
            }),
            task,
          }),
          requestId,
        )
      }

      case 'delete_task': {
        if (!intent.taskMatch?.title) {
          return ok(
            reply({ kind: 'needs_info', text: copy.assistant.needsTitle }),
            requestId,
          )
        }
        const match = matchTaskByTitle(
          intent.taskMatch.title,
          [...active, ...done.tasks],
        )
        if (match.kind === 'none') {
          return ok(
            reply({ kind: 'no_match', text: copy.assistant.noMatch }),
            requestId,
          )
        }
        if (match.kind === 'ambiguous') {
          return ok(
            reply({ kind: 'ambiguous', text: copy.assistant.tooManyMatches }),
            requestId,
          )
        }
        const title = match.task.title
        const removed = await deleteTask(userId, match.task.id)
        if (!removed) throw new ApiError('NOT_FOUND', 'Task not found.')
        return ok(
          reply({
            kind: 'action_done',
            text: fill(copy.assistant.actionDone.deleted, { title }),
          }),
          requestId,
        )
      }
    }
  },
)

function sanitiseIso(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
