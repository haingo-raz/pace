import { connection } from 'next/server'
import { AppShell } from '@/components/ui/AppShell'
import { SignOutButton } from './SignOutButton'
import { requireUser } from '@/lib/auth'
import { copy } from '@/content/en'

export const instant = false

export default async function DashboardPage() {
  await connection()
  const userId = await requireUser()

  return (
    <AppShell>
      <h1
        className="font-semibold text-[var(--text)]"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
          textWrap: 'balance',
        }}
      >
        {copy.app.name}
      </h1>
      <p className="mt-2 text-[var(--muted)]">
        {copy.auth.signedInAs}{' '}
        <span
          className="text-[var(--text)]"
          style={{ fontFamily: 'var(--font-jetbrains)' }}
        >
          {userId}
        </span>
      </p>
      <div className="mt-8">
        <SignOutButton />
      </div>
    </AppShell>
  )
}
