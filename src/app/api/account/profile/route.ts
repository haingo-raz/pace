import { z } from 'zod'
import { ApiError, ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import {
  getProfile,
  updateProfilePersonalization,
} from '@/lib/queries/profile'

const EMPLOYMENTS = [
  'full_time',
  'part_time',
  'unemployed',
  'volunteer_full_time',
  'volunteer_part_time',
  'student_full_time',
  'student_part_time',
] as const

const bodySchema = z
  .object({
    employment_status: z.enum(EMPLOYMENTS).nullable().optional(),
    preferred_name: z
      .string()
      .trim()
      .max(60)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
  })
  .strict()

export const POST = withRoute(
  'POST /api/account/profile',
  async (req, _ctx, requestId) => {
    const userId = await requireUser()
    const raw: unknown = await req.json().catch(() => ({}))
    const patch = bodySchema.parse(raw)
    const existing = await getProfile(userId)
    if (!existing) throw new ApiError('NOT_FOUND', 'Profile not found.')
    const profile = await updateProfilePersonalization(userId, patch)
    if (!profile) throw new ApiError('NOT_FOUND', 'Profile not found.')
    return ok({ profile }, requestId)
  },
)
