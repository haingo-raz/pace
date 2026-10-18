import { connection } from 'next/server'
import { AppShell } from '@/components/ui/AppShell'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { getProfile } from '@/lib/queries/profile'
import { SettingsShell } from './SettingsShell'

export const instant = false

export default async function SettingsPage() {
  await connection()
  const userId = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const email = (data?.claims?.email as string | undefined) ?? ''
  const profile = await getProfile(userId)

  return (
    <AppShell>
      <SettingsShell
        email={email}
        streakPaused={profile?.streak_paused ?? false}
        streakCount={profile?.streak_count ?? 0}
        employmentStatus={profile?.employment_status ?? null}
        preferredName={profile?.preferred_name ?? null}
      />
    </AppShell>
  )
}
