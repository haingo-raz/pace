'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy, fill } from '@/content/en'
import type { OrderedTasks } from '@/lib/ordering'
import type { MoodScore, Task } from '@/types'
import { Check, Trash2 } from 'lucide-react'

type Mutation = {
  pointsAwarded: number
  pointsTotal: number | null
}

type Props = {
  groups: OrderedTasks
  mood: MoodScore | null
  onCompleted: (m: Mutation) => void
  onDeleted: (id: string) => void
}

function stableDay(iso: string): string {
  return iso.slice(0, 10)
}

export function TaskList({ groups, mood, onCompleted, onDeleted }: Props) {
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const headingRef = useRef<HTMLHeadingElement>(null)
  const totalCount =
    groups.primary.length + groups.later.length + groups.completed.length
  const prevCount = useRef(totalCount)

  useEffect(() => {
    if (totalCount < prevCount.current && headingRef.current) {
      headingRef.current.focus()
    }
    prevCount.current = totalCount
  }, [totalCount])

  const isEmpty = totalCount === 0

  async function complete(task: Task) {
    if (busyId) return
    setBusyId(task.id)
    const res = await apiFetch<{
      task: Task
      pointsAwarded: number
      pointsTotal: number | null
    }>(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'complete' }),
    })
    setBusyId(null)
    if (!res.ok) {
      const msg =
        (copy.errors as Record<string, string | undefined>)[res.error.code] ??
        copy.errors.generic
      toast.error(msg)
      return
    }
    if (res.data.pointsAwarded > 0) {
      announce(fill(copy.tasks.announced, { points: res.data.pointsAwarded }))
    }
    onCompleted({
      pointsAwarded: res.data.pointsAwarded,
      pointsTotal: res.data.pointsTotal,
    })
  }

  async function remove(task: Task) {
    if (busyId) return
    setBusyId(task.id)
    const res = await apiFetch<{ id: string }>(`/api/tasks/${task.id}`, {
      method: 'DELETE',
    })
    setBusyId(null)
    if (!res.ok) {
      const msg =
        (copy.errors as Record<string, string | undefined>)[res.error.code] ??
        copy.errors.generic
      toast.error(msg)
      return
    }
    announce(copy.tasks.announcedDeleted)
    onDeleted(task.id)
  }

  function renderItem(t: Task) {
    return (
      <TaskRow
        key={t.id}
        task={t}
        mounted={mounted}
        busyHere={busyId === t.id}
        onComplete={() => complete(t)}
        onRemove={() => remove(t)}
      />
    )
  }

  return (
    <>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="sr-only focus:outline-none"
      >
        {copy.tasks.heading}
      </h3>
      {mood !== null ? (
        <p className="text-sm text-[var(--muted)]">{copy.tasks.moodNote[mood]}</p>
      ) : null}
      {isEmpty ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">{copy.tasks.empty}</p>
        </Card>
      ) : (
        <>
          {groups.primary.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {groups.primary.map(renderItem)}
            </ul>
          ) : null}
          {groups.later.length > 0 ? (
            <>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {copy.tasks.laterDivider}
              </p>
              <ul className="flex flex-col gap-2">
                {groups.later.map(renderItem)}
              </ul>
            </>
          ) : null}
          {groups.completed.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {groups.completed.map(renderItem)}
            </ul>
          ) : null}
        </>
      )}
    </>
  )
}

function TaskRow({
  task,
  mounted,
  busyHere,
  onComplete,
  onRemove,
}: {
  task: Task
  mounted: boolean
  busyHere: boolean
  onComplete: () => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const done = !!task.completed_at
  const overdue =
    mounted &&
    !done &&
    task.deadline !== null &&
    new Date(task.deadline) < new Date()
  const completeAria = done
    ? fill(copy.tasks.completedLabel, { title: task.title })
    : fill(copy.tasks.completeLabel, { title: task.title })
  const titleAria = expanded
    ? fill(copy.tasks.collapseTitle, { title: task.title })
    : fill(copy.tasks.expandTitle, { title: task.title })

  return (
    <li>
      <Card
        className={
          'flex items-center justify-between gap-3 py-3 ' +
          (done ? 'opacity-70' : '')
        }
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onComplete}
            disabled={done || busyHere}
            aria-label={completeAria}
            className={
              'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border ' +
              (done
                ? 'border-[var(--secondary)] bg-[var(--secondary)]/20 text-[var(--secondary)]'
                : 'border-[var(--border)] bg-[var(--raised)] text-[var(--muted)] hover:border-[var(--primary-strong)] hover:text-[var(--primary-strong)]')
            }
          >
            <Check aria-hidden="true" className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={titleAria}
              className="block w-full text-left focus:outline-none"
            >
              <span
                className={
                  'block text-[var(--text)] ' +
                  (done ? 'line-through ' : '') +
                  (expanded
                    ? 'line-clamp-3 overflow-y-auto max-h-[4.5em]'
                    : 'line-clamp-1')
                }
              >
                {task.title}
              </span>
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
              <span
                style={{
                  fontFamily: 'var(--font-jetbrains)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {task.difficulty === null
                  ? copy.tasks.difficultyUnrated
                  : fill(copy.tasks.difficulty, { n: task.difficulty })}
              </span>
              {task.deadline ? (
                <span
                  className={overdue ? 'text-[var(--danger)] font-medium' : ''}
                >
                  {overdue
                    ? copy.tasks.overdue + copy.tasks.metaSeparator
                    : ''}
                  {fill(copy.tasks.due, { date: stableDay(task.deadline) })}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={busyHere}
          aria-label={fill(copy.tasks.deleteLabel, { title: task.title })}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--danger)]"
        >
          <Trash2 aria-hidden="true" className="h-5 w-5" />
        </button>
      </Card>
    </li>
  )
}
