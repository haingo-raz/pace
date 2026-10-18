import { z } from 'zod'
import { createClient as createJsClient } from '@supabase/supabase-js'
import { ApiError, ok, withRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sql } from '@/lib/db'
import { logger } from '@/lib/logger'
import { copy } from '@/content/en'

const bodySchema = z
  .object({ password: z.string().min(1, copy.settings.passwordRequired) })
  .strict()

export const POST = withRoute(
  'POST /api/account/delete',
  async (req, _ctx, requestId) => {
    const userId = await requireUser()
    const raw: unknown = await req.json().catch(() => ({}))
    const { password } = bodySchema.parse(raw)

    const supabase = await createClient()
    const { data: claims } = await supabase.auth.getClaims()
    const currentEmail = claims?.claims?.email as string | undefined
    if (!currentEmail) {
      throw new ApiError('UNAUTHENTICATED', 'Sign in to continue.')
    }

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

    await sql.begin(async (tx) => {
      await tx`delete from points_log where user_id = ${userId}`
      await tx`delete from checkins where user_id = ${userId}`
      await tx`delete from tasks where user_id = ${userId}`
      await tx`delete from task_groups where user_id = ${userId}`
      await tx`delete from user_drawings where user_id = ${userId}`
      try {
        await tx`delete from insight_dismissals where user_id = ${userId}`
      } catch (e) {
        const code = (e as { code?: string }).code
        if (code !== '42P01') throw e
      }
      try {
        await tx`delete from insight_cache where user_id = ${userId}`
      } catch (e) {
        const code = (e as { code?: string }).code
        if (code !== '42P01') throw e
      }
      try {
        await tx`delete from quiz_attempts where user_id = ${userId}`
      } catch (e) {
        const code = (e as { code?: string }).code
        if (code !== '42P01') throw e
      }
      try {
        await tx`delete from skill_goals where user_id = ${userId}`
      } catch (e) {
        const code = (e as { code?: string }).code
        if (code !== '42P01') throw e
      }
      await tx`delete from profiles where user_id = ${userId}`
    })

    const admin = createAdminClient()
    const { error: adminErr } = await admin.auth.admin.deleteUser(userId)
    if (adminErr) {
      logger.error({
        requestId,
        event: 'account_delete_auth_failed',
        userId,
        message: adminErr.message,
      })
      throw new ApiError(
        'INTERNAL',
        'Account data removed but could not finish sign-out. Contact support.',
      )
    }

    logger.info({ requestId, event: 'account_deleted', userId })
    return ok({ deleted: true }, requestId)
  },
)
