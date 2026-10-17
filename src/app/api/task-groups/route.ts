import { z } from 'zod'
import { ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { insertGroup, listGroups } from '@/lib/queries/taskGroups'
import { TASK_GROUP_TITLE_MAX } from '@/config/constants'
import { copy, fill } from '@/content/en'

export const GET = withRoute('GET /api/task-groups', async (_req, _ctx, requestId) => {
  const userId = await requireUser()
  const groups = await listGroups(userId)
  return ok({ groups }, requestId)
})

const bodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, copy.groups.titleRequired)
      .max(
        TASK_GROUP_TITLE_MAX,
        fill(copy.groups.titleTooLong, { max: TASK_GROUP_TITLE_MAX }),
      ),
  })
  .strict()

export const POST = withRoute('POST /api/task-groups', async (req, _ctx, requestId) => {
  const userId = await requireUser()
  const raw: unknown = await req.json().catch(() => ({}))
  const { title } = bodySchema.parse(raw)
  const group = await insertGroup(userId, title)
  return ok({ group }, requestId)
})
