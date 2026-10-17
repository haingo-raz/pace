import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.error('Supabase env vars are missing')
  process.exit(1)
}

async function main() {
  const supabase = createClient(url!, key!)
  const { data, error } = await supabase.auth.getClaims()
  if (error) {
    console.error('auth error:', error.message)
    process.exitCode = 1
    return
  }
  console.log('auth reachable. claims:', data?.claims ?? null)
}

main()
