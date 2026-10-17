import { z } from 'zod'
import { ok, withRoute, ApiError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import {
  fillSection,
  getActivePage,
  getOrCreateDrawing,
} from '@/lib/queries/coloring'
import { logger } from '@/lib/logger'
import {
  COLOUR_PALETTE,
  COST_COLOR_SECTION,
  POINT_REASONS,
  SECTION_ID_MAX,
} from '@/config/constants'

const bodySchema = z
  .object({
    sectionId: z.string().min(1).max(SECTION_ID_MAX),
    colour: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, { error: 'Must be a #rrggbb colour.' }),
  })
  .strict()

export const POST = withRoute(
  'POST /api/coloring/section',
  async (req, _ctx, requestId) => {
    const userId = await requireUser()
    const raw: unknown = await req.json().catch(() => ({}))
    const { sectionId, colour } = bodySchema.parse(raw)

    const normalisedColour = colour.toUpperCase()
    const allowed = COLOUR_PALETTE.some(
      (p) => p.hex.toUpperCase() === normalisedColour,
    )
    if (!allowed) {
      throw new ApiError('VALIDATION_ERROR', 'That colour is not in the palette.', {
        fields: { colour: 'Choose a palette colour.' },
      })
    }

    const page = await getActivePage()
    if (!page) {
      throw new ApiError('NOT_FOUND', 'No coloring page is available.')
    }
    const validIds = new Set(page.sections.map((s) => s.id))
    if (!validIds.has(sectionId)) {
      throw new ApiError('VALIDATION_ERROR', 'Unknown section id.', {
        fields: { sectionId: 'That section is not on the page.' },
      })
    }

    const drawing = await getOrCreateDrawing(userId, page.id)
    if (drawing.completed_at) {
      throw new ApiError('CONFLICT', 'This page is already complete.')
    }

    const result = await fillSection(
      userId,
      drawing.id,
      sectionId,
      normalisedColour,
    )

    logger.info({
      event: 'points_spend',
      userId,
      amount: -COST_COLOR_SECTION,
      reason: POINT_REASONS.COLOR_SECTION,
      total: result.pointsTotal,
    })

    return ok(result, requestId)
  },
)
