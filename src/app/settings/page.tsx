import { connection } from 'next/server'
import { AppShell } from '@/components/ui/AppShell'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { SettingsShell } from './SettingsShell'

export const instant = false

export default async function SettingsPage() {
  await connection()
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const email = (data?.claims?.email as string | undefined) ?? ''

  return (
    <AppShell>
      <SettingsShell email={email} />
    </AppShell>
  )
}
