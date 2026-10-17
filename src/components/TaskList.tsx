'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy, fill } from '@/content/en'
import type { Task, TaskGroup } from '@/types'
import { Check, Trash2 } from 'lucide-react'

type Mutation = {
  pointsAwarded: number
  pointsTotal: number | null
}

type Props = {
  groups: TaskGroup[]
  tasks: Task[]
  onCompleted: (m: Mutation) => void
  onDeleted: (id: string) => void
}

function stableDay(iso: string): string {
  return iso.slice(0, 10)
}

type Section = { group: TaskGroup | null; tasks: Task[] }

function partition(groups: TaskGroup[], tasks: Task[]): Section[] {
  const byGroup = new Map<string, Task[]>()
  const ungrouped: Task[] = []
  for (const t of tasks) {
    if (t.group_id === null) {
      ungrouped.push(t)
    } else {
      const list = byGroup.get(t.group_id) ?? []
      list.push(t)
      byGroup.set(t.group_id, list)
    }
  }
  const sections: Section[] = []
  if (ungrouped.length > 0) sections.push({ group: null, tasks: ungrouped })
  for (const g of groups) {
    sections.push({ group: g, tasks: byGroup.get(g.id) ?? [] })
  }
  return sections
}

export function TaskList({ groups, tasks, onCompleted, onDeleted }: Props) {
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const headingRef = useRef<HTMLHeadingElement>(null)
  const prevCount = useRef(tasks.length)

  useEffect(() => {
    if (tasks.length < prevCount.current && headingRef.current) {
      headingRef.current.focus()
    }
    prevCount.current = tasks.length
  }, [tasks.length])

  const sections = useMemo(() => partition(groups, tasks), [groups, tasks])
  const isEmpty = tasks.length === 0 && groups.length === 0

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
      {isEmpty ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">{copy.tasks.empty}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sections.map((section) => {
            if (section.group === null) {
              return (
                <ul key="ungrouped" className="flex flex-col gap-2">
                  {section.tasks.map(renderItem)}
                </ul>
              )
            }
            const g = section.group
            const total = section.tasks.length
            const done = section.tasks.filter(
              (t) => t.completed_at !== null,
            ).length
            const summary =
              total === 1
                ? fill(copy.tasks.groupSummaryOne, { done })
                : fill(copy.tasks.groupSummary, { total, done })
            return (
              <section
                key={g.id}
                aria-labelledby={`group-${g.id}`}
                className="mt-2 flex flex-col gap-2"
              >
                <div>
                  <h3
                    id={`group-${g.id}`}
                    className="font-semibold text-[var(--text)]"
                    style={{
                      fontFamily: 'var(--font-fraunces)',
                      fontSize: 'clamp(1rem, 2vw, 1.15rem)',
                    }}
                  >
                    {g.title}
                  </h3>
                  <p className="text-xs text-[var(--muted)]">{summary}</p>
                </div>
                {section.tasks.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {section.tasks.map(renderItem)}
                  </ul>
                ) : null}
              </section>
            )
          })}
        </div>
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
