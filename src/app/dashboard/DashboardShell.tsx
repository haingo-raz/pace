'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PointsBadge } from '@/components/PointsBadge'
import { MoodCheckIn } from '@/components/MoodCheckIn'
import { TodayCard } from '@/components/TodayCard'
import { AddTaskForm } from '@/components/AddTaskForm'
import { GoalPlanner } from '@/components/GoalPlanner'
import { InsightCard } from '@/components/InsightCard'
import { TaskList } from '@/components/TaskList'
import type { Insight } from '@/lib/insights'
import { SignOutButton } from './SignOutButton'
import { announce } from '@/lib/announce'
import { apiFetch } from '@/lib/http'
import { POINTS_DELTA_MS } from '@/config/constants'
import { copy } from '@/content/en'
import type { CheckinResponse, MoodScore, Task, TaskGroup } from '@/types'

type Props = {
  pointsTotal: number
  streakCount: number
  hasCheckedIn: boolean
  todayMood: MoodScore | null
  pointsToday: number
  tasksDoneToday: number
  initialGroups: TaskGroup[]
  initialTasks: Task[]
  insight: Insight
  insightSentence: string
  streakAtRisk: boolean
}

type TasksResponse = { groups: TaskGroup[]; tasks: Task[] }

export function DashboardShell({
  pointsTotal,
  streakCount,
  hasCheckedIn: initialChecked,
  todayMood,
  pointsToday,
  tasksDoneToday,
  initialGroups,
  initialTasks,
  insight,
  insightSentence,
  streakAtRisk,
}: Props) {
  const router = useRouter()
  const [delta, setDelta] = useState<number | null>(null)
  const [hasCheckedIn, setHasCheckedIn] = useState(initialChecked)
  const [groups, setGroups] = useState<TaskGroup[]>(initialGroups)
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [tab, setTab] = useState<'manual' | 'plan'>('manual')
  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshSeq = useRef(0)

  useEffect(() => {
    return () => {
      if (deltaTimer.current) clearTimeout(deltaTimer.current)
    }
  }, [])

  function bumpPoints(pointsAwarded: number) {
    if (pointsAwarded <= 0) return
    setDelta(pointsAwarded)
    if (deltaTimer.current) clearTimeout(deltaTimer.current)
    deltaTimer.current = setTimeout(() => setDelta(null), POINTS_DELTA_MS)
    router.refresh()
  }

  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current
    const res = await apiFetch<TasksResponse>('/api/tasks')
    if (seq !== refreshSeq.current) return
    if (!res.ok) {
      setRefreshFailed(true)
      return
    }
    setRefreshFailed(false)
    setGroups(res.data.groups)
    setTasks(res.data.tasks)
  }, [])

  function onCheckedIn(res: CheckinResponse | null) {
    if (res) bumpPoints(res.pointsAwarded)
    setHasCheckedIn(true)
    router.refresh()
    void refresh()
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4">
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
        <div className="flex items-center gap-3">
          <PointsBadge total={pointsTotal} delta={delta} />
          <span
            className="text-sm text-[var(--muted)]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {copy.dashboard.streakLabel}{' '}
            <span
              className="text-[var(--text)] font-semibold"
              style={{ fontFamily: 'var(--font-jetbrains)' }}
            >
              {streakCount}
            </span>
          </span>
        </div>
      </header>

      <section className="mt-6">
        <InsightCard
          insight={insight}
          sentence={insightSentence}
          streakAtRisk={streakAtRisk}
        />
      </section>

      <section className="mt-6">
        {hasCheckedIn && todayMood !== null ? (
          <TodayCard
            initialMood={todayMood}
            pointsToday={pointsToday}
            tasksDoneToday={tasksDoneToday}
            onChanged={() => router.refresh()}
          />
        ) : (
          <MoodCheckIn onCheckedIn={onCheckedIn} />
        )}
      </section>

      <section className="mt-6">
        <h2
          className="font-semibold text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
          }}
        >
          {copy.tasks.heading}
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          {refreshFailed ? (
            <Card
              role="alert"
              className="flex items-center justify-between gap-3"
            >
              <p className="text-sm text-[var(--danger)]">
                {copy.tasks.loadFailed}
              </p>
              <Button type="button" onClick={() => void refresh()}>
                {copy.tasks.retry}
              </Button>
            </Card>
          ) : null}
          <div
            role="tablist"
            aria-label={copy.tasks.heading}
            className="flex flex-wrap gap-2 border-b border-[var(--border)]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'manual'}
              aria-controls="task-panel-manual"
              id="task-tab-manual"
              onClick={() => setTab('manual')}
              className={
                'min-h-11 px-4 text-sm font-medium border-b-2 -mb-px ' +
                (tab === 'manual'
                  ? 'border-[var(--primary-strong)] text-[var(--text)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]')
              }
            >
              {copy.planner.tabManual}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'plan'}
              aria-controls="task-panel-plan"
              id="task-tab-plan"
              onClick={() => setTab('plan')}
              className={
                'min-h-11 px-4 text-sm font-medium border-b-2 -mb-px ' +
                (tab === 'plan'
                  ? 'border-[var(--primary-strong)] text-[var(--text)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]')
              }
            >
              {copy.planner.tabPlan}
            </button>
          </div>
          <div
            role="tabpanel"
            id="task-panel-manual"
            aria-labelledby="task-tab-manual"
            hidden={tab !== 'manual'}
          >
            <AddTaskForm
              groups={groups}
              onAdded={(res) => {
                announce(copy.tasks.announcedAdded)
                bumpPoints(res.pointsAwarded)
                void refresh()
              }}
            />
          </div>
          <div
            role="tabpanel"
            id="task-panel-plan"
            aria-labelledby="task-tab-plan"
            hidden={tab !== 'plan'}
          >
            <GoalPlanner
              onAccepted={() => {
                setTab('manual')
                router.refresh()
                void refresh()
              }}
            />
          </div>
          <TaskList
            groups={groups}
            tasks={tasks}
            onCompleted={(m) => {
              bumpPoints(m.pointsAwarded)
              void refresh()
            }}
            onDeleted={() => {
              void refresh()
            }}
          />
        </div>
      </section>

      <div className="mt-10">
        <SignOutButton />
      </div>
    </>
  )
}
