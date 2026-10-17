import { createClient } from '@/lib/supabase/server'
import { ApiError } from '@/lib/api'

export async function requireUser(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (error || !userId) {
    throw new ApiError('UNAUTHENTICATED', 'Sign in to continue.')
  }
  return userId
}
