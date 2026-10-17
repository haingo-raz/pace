import { z } from 'zod'
import { createClient as createJsClient } from '@supabase/supabase-js'
import { ApiError, ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { hitRateLimit } from '@/lib/rateLimit'
import {
  CHANGE_EMAIL_MAX_PER_HOUR,
  CHANGE_EMAIL_WINDOW_MS,
} from '@/config/constants'
import { copy } from '@/content/en'

const bodySchema = z
  .object({
    newEmail: z.string().email(copy.settings.emailInvalid),
    password: z.string().min(1, copy.settings.passwordRequired),
  })
  .strict()

export const POST = withRoute(
  'POST /api/account/change-email',
  async (req, _ctx, requestId) => {
    const userId = await requireUser()
    const raw: unknown = await req.json().catch(() => ({}))
    const { newEmail, password } = bodySchema.parse(raw)

    const limit = hitRateLimit(
      `change-email:${userId}`,
      CHANGE_EMAIL_MAX_PER_HOUR,
      CHANGE_EMAIL_WINDOW_MS,
    )
    if (!limit.ok) {
      throw new ApiError('RATE_LIMITED', copy.errors.RATE_LIMITED, {
        retryAfterMs: limit.retryAfterMs,
      })
    }

    const supabase = await createClient()
    const { data: claims } = await supabase.auth.getClaims()
    const currentEmail = claims?.claims?.email as string | undefined
    if (!currentEmail) {
      throw new ApiError('UNAUTHENTICATED', 'Sign in to continue.')
    }

    // Verify password with a throwaway client so the user's real session
    // cookies are not touched.
    const verifier = createJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { error: pwErr } = await verifier.auth.signInWithPassword({
      email: currentEmail,
      password,
    })
    if (pwErr) {
      throw new ApiError(
        'VALIDATION_ERROR',
        copy.settings.passwordIncorrect,
        { fields: { password: copy.settings.passwordIncorrect } },
      )
    }

    const { data, error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) {
      logger.warn({
        requestId,
        event: 'change_email_failed',
        userId,
        status: error.status,
        code: error.code,
        message: error.message,
      })
      const status = error.status ?? 0
      if (error.code === 'email_exists' || status === 422) {
        throw new ApiError(
          'VALIDATION_ERROR',
          copy.settings.emailTaken,
          { fields: { newEmail: copy.settings.emailTaken } },
        )
      }
      if (error.code === 'email_address_invalid') {
        throw new ApiError(
          'VALIDATION_ERROR',
          copy.settings.emailRejected,
          { fields: { newEmail: copy.settings.emailRejected } },
        )
      }
      if (error.code === 'same_email') {
        throw new ApiError(
          'VALIDATION_ERROR',
          copy.settings.emailSame,
          { fields: { newEmail: copy.settings.emailSame } },
        )
      }
      if (status === 429) {
        throw new ApiError('RATE_LIMITED', copy.errors.RATE_LIMITED)
      }
      throw new ApiError('INTERNAL', copy.errors.generic)
    }

    const pending =
      Boolean(data.user?.new_email) || data.user?.email !== newEmail
    return ok({ pending }, requestId)
  },
)
