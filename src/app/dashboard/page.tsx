import { connection } from 'next/server'
import { AppShell } from '@/components/ui/AppShell'
import { DashboardShell } from './DashboardShell'
import { requireUser } from '@/lib/auth'
import { runDailyVisit } from '@/lib/dailyVisit'
import { getTodayCheckin } from '@/lib/queries/checkins'
import { listActiveTasks, listDoneTasks } from '@/lib/queries/tasks'
import { listGroups } from '@/lib/queries/taskGroups'
import { todayFor } from '@/lib/queries/day'
import { getTodayTotals } from '@/lib/queries/insights'
import { loadInsight } from '@/lib/insightLoader'
import { DONE_TASKS_LIMIT } from '@/config/constants'

export const instant = false

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await connection()
  const userId = await requireUser()
  const { profile, streakGraceUsed } = await runDailyVisit(userId)
  const today = todayFor(profile.timezone)
  const todayCheckin = await getTodayCheckin(userId, today)
  const mood = todayCheckin?.mood_score ?? null
  const [groups, active, done, insightPayload, todayTotals] = await Promise.all(
    [
      listGroups(userId),
      listActiveTasks(userId),
      listDoneTasks(userId, DONE_TASKS_LIMIT),
      loadInsight(
        userId,
        profile.timezone,
        today,
        profile.streak_count,
        'dashboard_load',
      ),
      getTodayTotals(userId, profile.timezone, today),
    ],
  )

  const params = await searchParams
  const rawView = params.view
  const viewParam = Array.isArray(rawView) ? rawView[0] : rawView
  const initialView: 'active' | 'done' = viewParam === 'done' ? 'done' : 'active'

  return (
    <AppShell>
      <DashboardShell
        pointsTotal={profile.points_total}
        streakCount={profile.streak_count}
        streakPaused={profile.streak_paused}
        hasCheckedIn={!!todayCheckin}
        todayMood={mood}
        pointsToday={todayTotals.pointsToday}
        tasksDoneToday={todayTotals.tasksDoneToday}
        initialGroups={groups}
        initialActive={active}
        initialDone={done.tasks}
        initialDoneTruncated={done.truncated}
        timezone={profile.timezone}
        initialView={initialView}
        insight={insightPayload.insight}
        insightSentence={insightPayload.sentence}
        streakAtRisk={streakGraceUsed}
      />
    </AppShell>
  )
}
