import { connection } from 'next/server'
import { AppShell } from '@/components/ui/AppShell'
import { SignOutButton } from './SignOutButton'
import { requireUser } from '@/lib/auth'
import { runDailyVisit } from '@/lib/dailyVisit'
import { copy } from '@/content/en'

export const instant = false

export default async function DashboardPage() {
  await connection()
  const userId = await requireUser()
  const { profile, visitAwarded } = await runDailyVisit(userId)

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

      <div className="mt-6 flex items-baseline gap-3">
        <span className="text-sm uppercase tracking-widest text-[var(--muted)]">
          {copy.dashboard.pointsLabel}
        </span>
        <span
          className="text-4xl font-bold text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-jetbrains)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {profile.points_total}
        </span>
      </div>

      <p className="mt-2 text-sm text-[var(--muted)]">
        {visitAwarded
          ? copy.dashboard.visitAwarded
          : copy.dashboard.visitAlready}
      </p>

      <p className="mt-6 text-[var(--muted)] text-sm">
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
