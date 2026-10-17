import { connection } from 'next/server'
import { AppShell } from '@/components/ui/AppShell'
import { DashboardShell } from './DashboardShell'
import { requireUser } from '@/lib/auth'
import { runDailyVisit } from '@/lib/dailyVisit'
import { getTodayCheckin } from '@/lib/queries/checkins'
import { listTasks } from '@/lib/queries/tasks'
import { todayFor } from '@/lib/queries/day'

export const instant = false

export default async function DashboardPage() {
  await connection()
  const userId = await requireUser()
  const { profile } = await runDailyVisit(userId)
  const today = todayFor(profile.timezone)
  const [todayCheckin, tasks] = await Promise.all([
    getTodayCheckin(userId, today),
    listTasks(userId),
  ])

  return (
    <AppShell>
      <DashboardShell
        pointsTotal={profile.points_total}
        streakCount={profile.streak_count}
        hasCheckedIn={!!todayCheckin}
        initialTasks={tasks}
      />
    </AppShell>
  )
}
