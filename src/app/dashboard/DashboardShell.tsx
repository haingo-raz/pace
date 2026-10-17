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
import { BrandMark } from '@/components/BrandMark'
import { ThemeToggle } from '@/components/ThemeToggle'
import { StarGlyph } from '@/components/StarGlyph'
import type { Insight } from '@/lib/insights'
import { SignOutButton } from './SignOutButton'
import { announce } from '@/lib/announce'
import { apiFetch } from '@/lib/http'
import { POINTS_DELTA_MS } from '@/config/constants'
import { copy, fill } from '@/content/en'
import type { CheckinResponse, MoodScore, Task, TaskGroup } from '@/types'
import { Zap } from 'lucide-react'

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
  const tabRefs = useRef<Record<'plan' | 'manual', HTMLButtonElement | null>>({
    plan: null,
    manual: null,
  })

  function onTabKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const next = tab === 'plan' ? 'manual' : 'plan'
      setTab(next)
      tabRefs.current[next]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      setTab('plan')
      tabRefs.current.plan?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      setTab('manual')
      tabRefs.current.manual?.focus()
    }
  }
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
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="md:hidden">
          <BrandMark size="lg" />
        </div>
        <div className="hidden md:block flex-1" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <PointsBadge total={pointsTotal} delta={delta} />
          <span
            aria-label={fill(copy.dashboard.streakAria, { n: streakCount })}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--accent)]/20 px-3 min-h-11 text-sm text-[var(--text)]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <Zap
              aria-hidden="true"
              className="h-4 w-4 text-[var(--primary-strong)]"
              fill="currentColor"
            />
            <span
              className="font-semibold"
              style={{ fontFamily: 'var(--font-jetbrains)' }}
            >
              {streakCount}
            </span>
          </span>
          <ThemeToggle />
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
            onKeyDown={onTabKey}
            className="flex gap-1 -mb-px"
          >
            <button
              ref={(el) => {
                tabRefs.current.plan = el
              }}
              type="button"
              role="tab"
              aria-selected={tab === 'plan'}
              aria-controls="task-panel-plan"
              id="task-tab-plan"
              tabIndex={tab === 'plan' ? 0 : -1}
              onClick={() => setTab('plan')}
              className={
                'flex-1 md:flex-none min-h-11 px-4 text-sm font-medium inline-flex items-center justify-center gap-2 border border-b-0 rounded-t-[var(--radius)] ' +
                (tab === 'plan'
                  ? 'bg-[var(--raised)] border-[var(--primary-strong)] text-[var(--text)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]')
              }
            >
              <StarGlyph
                className={
                  'h-4 w-4 ' +
                  (tab === 'plan'
                    ? 'text-[var(--primary-strong)]'
                    : 'text-[var(--muted-soft)]')
                }
              />
              {copy.planner.tabPlan}
            </button>
            <button
              ref={(el) => {
                tabRefs.current.manual = el
              }}
              type="button"
              role="tab"
              aria-selected={tab === 'manual'}
              aria-controls="task-panel-manual"
              id="task-tab-manual"
              tabIndex={tab === 'manual' ? 0 : -1}
              onClick={() => setTab('manual')}
              className={
                'flex-1 md:flex-none min-h-11 px-4 text-sm font-medium inline-flex items-center justify-center border border-b-0 rounded-t-[var(--radius)] ' +
                (tab === 'manual'
                  ? 'bg-[var(--raised)] border-[var(--primary-strong)] text-[var(--text)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]')
              }
            >
              {copy.planner.tabManual}
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
            onChanged={() => {
              router.refresh()
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
