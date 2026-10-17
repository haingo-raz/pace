'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PointsBadge } from '@/components/PointsBadge'
import { MoodCheckIn } from '@/components/MoodCheckIn'
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
import type { OrderedTasks } from '@/lib/ordering'
import type { CheckinResponse, MoodScore } from '@/types'

type Props = {
  pointsTotal: number
  streakCount: number
  hasCheckedIn: boolean
  initialGroups: OrderedTasks
  initialMood: MoodScore | null
  insight: Insight
  insightSentence: string
  streakAtRisk: boolean
}

type GroupsResponse = OrderedTasks & { mood: MoodScore | null }

export function DashboardShell({
  pointsTotal: initialPoints,
  streakCount,
  hasCheckedIn: initialChecked,
  initialGroups,
  initialMood,
  insight,
  insightSentence,
  streakAtRisk,
}: Props) {
  const [points, setPoints] = useState(initialPoints)
  const [delta, setDelta] = useState<number | null>(null)
  const [hasCheckedIn, setHasCheckedIn] = useState(initialChecked)
  const [groups, setGroups] = useState<OrderedTasks>(initialGroups)
  const [mood, setMood] = useState<MoodScore | null>(initialMood)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [tab, setTab] = useState<'manual' | 'plan'>('manual')
  const loggedRef = useRef<HTMLDivElement>(null)
  const shouldFocusLogged = useRef(false)
  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshSeq = useRef(0)

  useEffect(() => {
    if (hasCheckedIn && shouldFocusLogged.current && loggedRef.current) {
      loggedRef.current.focus()
      shouldFocusLogged.current = false
    }
  }, [hasCheckedIn])

  useEffect(() => {
    return () => {
      if (deltaTimer.current) clearTimeout(deltaTimer.current)
    }
  }, [])

  function bumpPoints(pointsAwarded: number, pointsTotal: number | null) {
    if (pointsAwarded <= 0 || pointsTotal === null) return
    setPoints(pointsTotal)
    setDelta(pointsAwarded)
    if (deltaTimer.current) clearTimeout(deltaTimer.current)
    deltaTimer.current = setTimeout(() => setDelta(null), POINTS_DELTA_MS)
  }

  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current
    const res = await apiFetch<GroupsResponse>('/api/tasks')
    if (seq !== refreshSeq.current) return
    if (!res.ok) {
      setRefreshFailed(true)
      return
    }
    setRefreshFailed(false)
    setGroups({
      primary: res.data.primary,
      later: res.data.later,
      completed: res.data.completed,
    })
    setMood(res.data.mood)
  }, [])

  function onCheckedIn(res: CheckinResponse | null) {
    if (res) bumpPoints(res.pointsAwarded, res.pointsTotal)
    shouldFocusLogged.current = true
    setHasCheckedIn(true)
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
          <PointsBadge total={points} delta={delta} />
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
        {hasCheckedIn ? (
          <Card
            ref={loggedRef}
            tabIndex={-1}
            aria-live="polite"
            className="focus:outline-none"
          >
            <p className="text-[var(--muted)]">{copy.checkin.done}</p>
          </Card>
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
              onAdded={(res) => {
                announce(copy.tasks.announcedAdded)
                bumpPoints(res.pointsAwarded, res.pointsTotal)
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
                void refresh()
              }}
            />
          </div>
          <TaskList
            groups={groups}
            mood={mood}
            onCompleted={(m) => {
              bumpPoints(m.pointsAwarded, m.pointsTotal)
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
