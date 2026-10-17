import { z } from 'zod'
import { ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { sql } from '@/lib/db'
import { getProfile } from '@/lib/queries/profile'
import { insertTask } from '@/lib/queries/tasks'
import { insertGroup } from '@/lib/queries/taskGroups'
import {
  DAY_OFFSET_MAX,
  DEADLINE_END_OF_DAY_HOUR,
  DEADLINE_END_OF_DAY_MINUTE,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  MAX_GENERATED_TASKS,
  TASK_GROUP_DEFAULT_TITLE,
  TASK_GROUP_TITLE_MAX,
  TASK_TITLE_MAX,
} from '@/config/constants'
import type { Difficulty, Task, TaskGroup } from '@/types'

const taskSchema = z
  .object({
    title: z.string().trim().min(1).max(TASK_TITLE_MAX),
    difficulty: z.number().int().min(DIFFICULTY_MIN).max(DIFFICULTY_MAX),
    dayOffset: z.number().int().min(0).max(DAY_OFFSET_MAX),
  })
  .strict()

const bodySchema = z
  .object({
    groupName: z.string().trim().max(TASK_GROUP_TITLE_MAX),
    tasks: z.array(taskSchema).min(1).max(MAX_GENERATED_TASKS),
  })
  .strict()

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/**
 * Returns the UTC-offset minutes for `timezone` at `instant` (e.g. -300 for
 * America/Toronto in EST). Positive east of UTC.
 */
function utcOffsetMinutes(timezone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(instant)
  const label = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(label)
  if (!m) return 0
  const sign = m[1] === '+' ? 1 : -1
  const hours = Number(m[2])
  const minutes = m[3] ? Number(m[3]) : 0
  return sign * (hours * 60 + minutes)
}

function deadlineFor(timezone: string, dayOffset: number, now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const base = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + dayOffset)
  const y = base.getUTCFullYear()
  const mo = pad2(base.getUTCMonth() + 1)
  const d = pad2(base.getUTCDate())
  const hh = pad2(DEADLINE_END_OF_DAY_HOUR)
  const mm = pad2(DEADLINE_END_OF_DAY_MINUTE)
  const naiveUtc = new Date(`${y}-${mo}-${d}T${hh}:${mm}:00Z`)
  const offset = utcOffsetMinutes(timezone, naiveUtc)
  return new Date(naiveUtc.getTime() - offset * 60_000)
}

export const POST = withRoute(
  'POST /api/goals/accept',
  async (req, _ctx, requestId) => {
    const userId = await requireUser()
    const raw: unknown = await req.json().catch(() => ({}))
    const { groupName, tasks } = bodySchema.parse(raw)

    const profile = await getProfile(userId)
    const timezone = profile?.timezone ?? 'UTC'
    const now = new Date()
    const title = groupName.trim() || TASK_GROUP_DEFAULT_TITLE

    const result = await sql.begin(async (tx) => {
      const group: TaskGroup = await insertGroup(userId, title, tx)
      const rows: Task[] = []
      for (const t of tasks) {
        const deadline = deadlineFor(timezone, t.dayOffset, now).toISOString()
        const row = await insertTask(
          userId,
          t.title,
          t.difficulty as Difficulty,
          deadline,
          group.id,
          tx,
        )
        rows.push(row)
      }
      return { group, tasks: rows }
    })

    return ok(result, requestId)
  },
)
