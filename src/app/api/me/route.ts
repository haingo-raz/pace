import { requireUser } from '@/lib/auth'
import { ok, withRoute } from '@/lib/api'

export const GET = withRoute('GET /api/me', async (_req, _ctx, requestId) => {
  const userId = await requireUser()
  return ok({ userId }, requestId)
})
