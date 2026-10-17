import { connection } from 'next/server'
import { AppShell } from '@/components/ui/AppShell'
import { DashboardShell } from './DashboardShell'
import { requireUser } from '@/lib/auth'
import { runDailyVisit } from '@/lib/dailyVisit'
import { getTodayCheckin } from '@/lib/queries/checkins'
import { listTasksOrdered } from '@/lib/queries/tasks'
import { todayFor } from '@/lib/queries/day'
import { loadInsight } from '@/lib/insightLoader'

export const instant = false

export default async function DashboardPage() {
  await connection()
  const userId = await requireUser()
  const { profile, streakGraceUsed } = await runDailyVisit(userId)
  const today = todayFor(profile.timezone)
  const todayCheckin = await getTodayCheckin(userId, today)
  const mood = todayCheckin?.mood_score ?? null
  const [groups, insightPayload] = await Promise.all([
    listTasksOrdered(userId, mood),
    loadInsight(
      userId,
      profile.timezone,
      today,
      profile.streak_count,
      'dashboard_load',
    ),
  ])

  return (
    <AppShell>
      <DashboardShell
        pointsTotal={profile.points_total}
        streakCount={profile.streak_count}
        hasCheckedIn={!!todayCheckin}
        initialGroups={groups}
        initialMood={mood}
        insight={insightPayload.insight}
        insightSentence={insightPayload.sentence}
        streakAtRisk={streakGraceUsed}
      />
    </AppShell>
  )
}
