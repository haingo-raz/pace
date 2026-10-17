import { connection } from 'next/server'
import { AppShell } from '@/components/ui/AppShell'
import { DashboardShell } from './DashboardShell'
import { requireUser } from '@/lib/auth'
import { runDailyVisit } from '@/lib/dailyVisit'
import { getTodayCheckin } from '@/lib/queries/checkins'
import { listTasks } from '@/lib/queries/tasks'
import { listGroups } from '@/lib/queries/taskGroups'
import { todayFor } from '@/lib/queries/day'
import { getTodayTotals } from '@/lib/queries/insights'
import { loadInsight } from '@/lib/insightLoader'

export const instant = false

export default async function DashboardPage() {
  await connection()
  const userId = await requireUser()
  const { profile, streakGraceUsed } = await runDailyVisit(userId)
  const today = todayFor(profile.timezone)
  const todayCheckin = await getTodayCheckin(userId, today)
  const mood = todayCheckin?.mood_score ?? null
  const [groups, tasks, insightPayload, todayTotals] = await Promise.all([
    listGroups(userId),
    listTasks(userId),
    loadInsight(
      userId,
      profile.timezone,
      today,
      profile.streak_count,
      'dashboard_load',
    ),
    getTodayTotals(userId, profile.timezone, today),
  ])

  return (
    <AppShell>
      <DashboardShell
        pointsTotal={profile.points_total}
        streakCount={profile.streak_count}
        hasCheckedIn={!!todayCheckin}
        todayMood={mood}
        pointsToday={todayTotals.pointsToday}
        tasksDoneToday={todayTotals.tasksDoneToday}
        initialGroups={groups}
        initialTasks={tasks}
        insight={insightPayload.insight}
        insightSentence={insightPayload.sentence}
        streakAtRisk={streakGraceUsed}
      />
    </AppShell>
  )
}
