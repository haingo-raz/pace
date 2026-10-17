import { z } from 'zod'
import { ok, withRoute, ApiError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import {
  getMostRecentPageId,
  getOrCreateDrawing,
  listPages,
} from '@/lib/queries/coloring'
import { getProfile } from '@/lib/queries/profile'
import { COST_COLOR_SECTION } from '@/config/constants'

const querySchema = z.object({ pageId: z.string().uuid().optional() })

export const GET = withRoute('GET /api/coloring', async (req, _ctx, requestId) => {
  const userId = await requireUser()
  const url = new URL(req.url)
  const { pageId } = querySchema.parse({
    pageId: url.searchParams.get('pageId') ?? undefined,
  })

  const pages = await listPages()
  if (pages.length === 0) {
    throw new ApiError('NOT_FOUND', 'No coloring page is available.')
  }

  const preferred =
    pageId ?? (await getMostRecentPageId(userId)) ?? pages[0].id
  const page = pages.find((p) => p.id === preferred) ?? pages[0]

  const drawing = await getOrCreateDrawing(userId, page.id)
  const profile = await getProfile(userId)

  return ok(
    {
      pages,
      page,
      state: drawing.sections_state,
      pointsTotal: profile?.points_total ?? 0,
      costPerSection: COST_COLOR_SECTION,
      complete: !!drawing.completed_at,
    },
    requestId,
  )
})
