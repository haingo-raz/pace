import 'server-only'
import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_SECRET_KEY) {
  throw new Error('SUPABASE_SECRET_KEY is not set')
}

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
