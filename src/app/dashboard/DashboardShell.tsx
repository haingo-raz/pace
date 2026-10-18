'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
  streakPaused: boolean
  hasCheckedIn: boolean
  todayMood: MoodScore | null
  pointsToday: number
  tasksDoneToday: number
  initialGroups: TaskGroup[]
  initialActive: Task[]
  initialDone: Task[]
  initialDoneTruncated: boolean
  timezone: string
  initialView: 'active' | 'done'
  insight: Insight
  insightSentence: string
  streakAtRisk: boolean
  preferredName: string | null
}

type TasksResponse = {
  groups: TaskGroup[]
  active: Task[]
  done: Task[]
  doneTruncated: boolean
}

type View = 'active' | 'done'
type InputTab = 'manual' | 'plan'

export function DashboardShell({
  pointsTotal,
  streakCount,
  streakPaused,
  hasCheckedIn: initialChecked,
  todayMood,
  pointsToday,
  tasksDoneToday,
  initialGroups,
  initialActive,
  initialDone,
  initialDoneTruncated,
  timezone,
  initialView,
  insight,
  insightSentence,
  streakAtRisk,
  preferredName,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [delta, setDelta] = useState<number | null>(null)
  const [hasCheckedIn, setHasCheckedIn] = useState(initialChecked)
  const [groups, setGroups] = useState<TaskGroup[]>(initialGroups)
  const [active, setActive] = useState<Task[]>(initialActive)
  const [done, setDone] = useState<Task[]>(initialDone)
  const [doneTruncated, setDoneTruncated] = useState(initialDoneTruncated)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [inputTab, setInputTab] = useState<InputTab>('manual')
  const [view, setView] = useState<View>(initialView)

  const inputTabRefs = useRef<Record<InputTab, HTMLButtonElement | null>>({
    plan: null,
    manual: null,
  })
  const viewTabRefs = useRef<Record<View, HTMLButtonElement | null>>({
    active: null,
    done: null,
  })

  function onInputTabKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const next: InputTab = inputTab === 'plan' ? 'manual' : 'plan'
      setInputTab(next)
      inputTabRefs.current[next]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      setInputTab('plan')
      inputTabRefs.current.plan?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      setInputTab('manual')
      inputTabRefs.current.manual?.focus()
    }
  }

  function pickView(next: View) {
    setView(next)
    const url = next === 'active' ? pathname : `${pathname}?view=done`
    window.history.replaceState(null, '', url)
  }

  function onViewTabKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const next: View = view === 'active' ? 'done' : 'active'
      pickView(next)
      viewTabRefs.current[next]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      pickView('active')
      viewTabRefs.current.active?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      pickView('done')
      viewTabRefs.current.done?.focus()
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
    setActive(res.data.active)
    setDone(res.data.done)
    setDoneTruncated(res.data.doneTruncated)
  }, [])

  function onCheckedIn(res: CheckinResponse | null) {
    if (res) bumpPoints(res.pointsAwarded)
    setHasCheckedIn(true)
    router.refresh()
    void refresh()
  }

  useEffect(() => {
    const onExternalChange = () => void refresh()
    window.addEventListener('pace:tasks-changed', onExternalChange)
    return () =>
      window.removeEventListener('pace:tasks-changed', onExternalChange)
  }, [refresh])

  return (
    <>
      <header
        className="sticky top-0 z-30 -mx-4 px-4 py-2 flex items-center justify-between gap-3 flex-wrap backdrop-blur bg-[var(--bg)]/85 border-b border-[var(--border)]"
      >
        <div className="md:hidden">
          <BrandMark size="lg" />
        </div>
        <div className="hidden md:block flex-1" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <span title={copy.tasks.tooltipPoints}>
            <PointsBadge total={pointsTotal} delta={delta} />
          </span>
          <span
            aria-label={
              streakPaused
                ? copy.settings.streakStatusPaused
                : fill(copy.dashboard.streakAria, { n: streakCount })
            }
            title={
              streakPaused
                ? copy.settings.streakStatusPaused
                : copy.tasks.tooltipStreak
            }
            className={
              'inline-flex items-center gap-1 rounded-full border px-3 min-h-11 text-sm text-[var(--text)] ' +
              (streakPaused
                ? 'border-[var(--border)] bg-[var(--surface)] opacity-70'
                : 'border-[var(--border)] bg-[var(--accent)]/20')
            }
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <Zap
              aria-hidden="true"
              className={
                'h-4 w-4 ' +
                (streakPaused
                  ? 'text-[var(--muted)]'
                  : 'text-[var(--primary-strong)]')
              }
              fill={streakPaused ? 'none' : 'currentColor'}
            />
            <span
              className="font-semibold"
              style={{ fontFamily: 'var(--font-jetbrains)' }}
            >
              {streakCount}
            </span>
            {streakPaused ? (
              <span className="text-xs text-[var(--muted)] ml-1">
                {copy.dashboard.streakPausedTag}
              </span>
            ) : null}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <section className="mt-4">
        <h1
          className="font-semibold text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
          }}
        >
          {preferredName
            ? fill(copy.dashboard.greetingNamed, { name: preferredName })
            : copy.dashboard.greetingAnon}
        </h1>
      </section>

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
            onKeyDown={onInputTabKey}
            className="flex gap-1 -mb-px"
          >
            <button
              ref={(el) => {
                inputTabRefs.current.plan = el
              }}
              type="button"
              role="tab"
              aria-selected={inputTab === 'plan'}
              aria-controls="task-panel-plan"
              id="task-tab-plan"
              tabIndex={inputTab === 'plan' ? 0 : -1}
              onClick={() => setInputTab('plan')}
              className={
                'flex-1 md:flex-none min-h-11 px-4 text-sm font-medium inline-flex items-center justify-center gap-2 border border-b-0 rounded-t-[var(--radius)] ' +
                (inputTab === 'plan'
                  ? 'bg-[var(--raised)] border-[var(--primary-strong)] text-[var(--text)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]')
              }
            >
              <StarGlyph
                className={
                  'h-4 w-4 ' +
                  (inputTab === 'plan'
                    ? 'text-[var(--primary-strong)]'
                    : 'text-[var(--muted-soft)]')
                }
              />
              {copy.planner.tabPlan}
            </button>
            <button
              ref={(el) => {
                inputTabRefs.current.manual = el
              }}
              type="button"
              role="tab"
              aria-selected={inputTab === 'manual'}
              aria-controls="task-panel-manual"
              id="task-tab-manual"
              tabIndex={inputTab === 'manual' ? 0 : -1}
              onClick={() => setInputTab('manual')}
              className={
                'flex-1 md:flex-none min-h-11 px-4 text-sm font-medium inline-flex items-center justify-center border border-b-0 rounded-t-[var(--radius)] ' +
                (inputTab === 'manual'
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
            hidden={inputTab !== 'manual'}
          >
            <AddTaskForm
              groups={groups}
              onAdded={(res) => {
                announce(copy.tasks.announcedAdded)
                bumpPoints(res.pointsAwarded)
                void refresh()
              }}
              onGroupCreated={() => {
                void refresh()
              }}
            />
          </div>
          <div
            role="tabpanel"
            id="task-panel-plan"
            aria-labelledby="task-tab-plan"
            hidden={inputTab !== 'plan'}
          >
            <GoalPlanner
              onAccepted={() => {
                setInputTab('manual')
                router.refresh()
                void refresh()
              }}
            />
          </div>

          <div
            role="tablist"
            aria-label={copy.tasks.tabsLabel}
            onKeyDown={onViewTabKey}
            className="mt-2 flex gap-1 border-b border-[var(--border)]"
          >
            <button
              ref={(el) => {
                viewTabRefs.current.active = el
              }}
              type="button"
              role="tab"
              aria-selected={view === 'active'}
              aria-controls="task-panel-active"
              id="task-view-active"
              tabIndex={view === 'active' ? 0 : -1}
              onClick={() => pickView('active')}
              className={
                'min-h-11 px-4 text-sm font-medium -mb-px border-b-2 ' +
                (view === 'active'
                  ? 'border-[var(--primary-strong)] text-[var(--text)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]')
              }
            >
              {copy.tasks.tabActive}
            </button>
            <button
              ref={(el) => {
                viewTabRefs.current.done = el
              }}
              type="button"
              role="tab"
              aria-selected={view === 'done'}
              aria-controls="task-panel-done"
              id="task-view-done"
              tabIndex={view === 'done' ? 0 : -1}
              onClick={() => pickView('done')}
              className={
                'min-h-11 px-4 text-sm font-medium -mb-px border-b-2 ' +
                (view === 'done'
                  ? 'border-[var(--primary-strong)] text-[var(--text)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]')
              }
            >
              {copy.tasks.tabDone}
            </button>
          </div>
          <div
            role="tabpanel"
            id="task-panel-active"
            aria-labelledby="task-view-active"
            hidden={view !== 'active'}
          >
            <TaskList
              mode="active"
              groups={groups}
              tasks={active}
              timezone={timezone}
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
          <div
            role="tabpanel"
            id="task-panel-done"
            aria-labelledby="task-view-done"
            hidden={view !== 'done'}
          >
            <TaskList
              mode="done"
              groups={groups}
              tasks={done}
              timezone={timezone}
              truncated={doneTruncated}
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
              onRestored={(task) => {
                setDone((prev) => prev.filter((t) => t.id !== task.id))
                setActive((prev) =>
                  prev.some((t) => t.id === task.id) ? prev : [...prev, task],
                )
                pickView('active')
                router.refresh()
                void refresh()
              }}
            />
          </div>
        </div>
      </section>

      <div className="mt-10">
        <SignOutButton />
      </div>
    </>
  )
}
