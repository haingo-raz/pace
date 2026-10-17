import { ok, withRoute, ApiError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import {
  getActivePage,
  getOrCreateDrawing,
} from '@/lib/queries/coloring'
import { getProfile } from '@/lib/queries/profile'
import { COST_COLOR_SECTION } from '@/config/constants'

export const GET = withRoute('GET /api/coloring', async (_req, _ctx, requestId) => {
  const userId = await requireUser()
  const page = await getActivePage()
  if (!page) {
    throw new ApiError('NOT_FOUND', 'No coloring page is available.')
  }
  const drawing = await getOrCreateDrawing(userId, page.id)
  const profile = await getProfile(userId)

  return ok(
    {
      page,
      state: drawing.sections_state,
      pointsTotal: profile?.points_total ?? 0,
      costPerSection: COST_COLOR_SECTION,
      complete: !!drawing.completed_at,
    },
    requestId,
  )
})
