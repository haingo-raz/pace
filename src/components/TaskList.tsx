'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Card } from '@/components/ui/Card'
import { Menu, type MenuItem } from '@/components/ui/Menu'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy, fill } from '@/content/en'
import { formatShortDate } from '@/lib/formatDate'
import {
  DIFFICULTY_HEAVY_MIN,
  DIFFICULTY_LIGHT_MAX,
} from '@/config/constants'
import type { Task, TaskGroup } from '@/types'
import { Check, MoreHorizontal } from 'lucide-react'
import { TaskEditForm } from '@/components/TaskEditForm'

type DifficultyBand = 'none' | 'easy' | 'medium' | 'hard'

function bandFor(d: number | null): DifficultyBand {
  if (d === null) return 'none'
  if (d <= DIFFICULTY_LIGHT_MAX) return 'easy'
  if (d >= DIFFICULTY_HEAVY_MIN) return 'hard'
  return 'medium'
}

function bandAccent(b: DifficultyBand): string {
  if (b === 'easy') return 'var(--secondary)'
  if (b === 'medium') return 'var(--accent)'
  if (b === 'hard') return 'var(--primary-strong)'
  return 'var(--border)'
}

function bandLabel(b: DifficultyBand): string | null {
  if (b === 'easy') return copy.tasks.difficultyEasy
  if (b === 'medium') return copy.tasks.difficultyMedium
  if (b === 'hard') return copy.tasks.difficultyHard
  return null
}

type Mutation = {
  pointsAwarded: number
  pointsTotal: number | null
}

type Props = {
  mode: 'active' | 'done'
  groups: TaskGroup[]
  tasks: Task[]
  timezone: string
  truncated?: boolean
  onCompleted: (m: Mutation) => void
  onDeleted: (id: string) => void
  onChanged: () => void
  onRestored?: (task: Task) => void
}

type Section = { group: TaskGroup | null; tasks: Task[] }

function partition(groups: TaskGroup[], tasks: Task[]): Section[] {
  const knownGroupIds = new Set(groups.map((g) => g.id))
  const byGroup = new Map<string, Task[]>()
  const ungrouped: Task[] = []
  for (const t of tasks) {
    if (t.group_id === null || !knownGroupIds.has(t.group_id)) {
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

export function TaskList({
  mode,
  groups,
  tasks,
  timezone,
  truncated,
  onCompleted,
  onDeleted,
  onChanged,
  onRestored,
}: Props) {
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

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
  const isEmpty = tasks.length === 0 && (mode === 'done' || groups.length === 0)

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
    toast.success(copy.tasks.toastCompleted)
    onCompleted({
      pointsAwarded: res.data.pointsAwarded,
      pointsTotal: res.data.pointsTotal,
    })
  }

  async function uncomplete(task: Task) {
    if (busyId) return
    setBusyId(task.id)
    const res = await apiFetch<{ task: Task }>(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'uncomplete' }),
    })
    setBusyId(null)
    if (!res.ok) {
      const msg =
        (copy.errors as Record<string, string | undefined>)[res.error.code] ??
        copy.errors.generic
      toast.error(msg)
      return
    }
    announce(copy.tasks.announcedUncompleted)
    toast.success(copy.tasks.toastUncompleted)
    if (mode === 'done' && onRestored) {
      announce(copy.tasks.announcedRestoredToActive)
      onRestored(res.data.task)
      return
    }
    onChanged()
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
    toast.success(copy.tasks.toastDeleted)
    onDeleted(task.id)
  }

  function renderItem(t: Task) {
    if (editingId === t.id) {
      return (
        <li key={t.id}>
          <TaskEditForm
            task={t}
            groups={groups}
            onSaved={() => {
              setEditingId(null)
              onChanged()
            }}
            onCancel={() => setEditingId(null)}
          />
        </li>
      )
    }
    return (
      <TaskRow
        key={t.id}
        task={t}
        mounted={mounted}
        timezone={timezone}
        busyHere={busyId === t.id}
        onComplete={() => complete(t)}
        onEdit={() => setEditingId(t.id)}
        onToggleComplete={() => (t.completed_at ? uncomplete(t) : complete(t))}
        onDelete={() => remove(t)}
      />
    )
  }

  const emptyMessage =
    mode === 'done' ? copy.tasks.emptyDone : copy.tasks.emptyActive

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
          <p className="text-sm text-[var(--muted)]">{emptyMessage}</p>
        </Card>
      ) : mode === 'done' ? (
        <>
          <ul className="flex flex-col gap-2">{tasks.map(renderItem)}</ul>
          {truncated ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {copy.tasks.doneTruncated}
            </p>
          ) : null}
        </>
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
                  {/* Per-group task count ("X tasks, Y done") hidden intentionally. */}
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
  timezone,
  busyHere,
  onComplete,
  onEdit,
  onToggleComplete,
  onDelete,
}: {
  task: Task
  mounted: boolean
  timezone: string
  busyHere: boolean
  onComplete: () => void
  onEdit: () => void
  onToggleComplete: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const done = !!task.completed_at
  const overdue =
    mounted &&
    !done &&
    task.deadline !== null &&
    new Date(task.deadline) < new Date()
  const onTime =
    done &&
    task.deadline !== null &&
    task.completed_at !== null &&
    task.completed_at <= task.deadline
  const completeAria = done
    ? fill(copy.tasks.completedLabel, { title: task.title })
    : fill(copy.tasks.completeLabel, { title: task.title })
  const titleAria = expanded
    ? fill(copy.tasks.collapseTitle, { title: task.title })
    : fill(copy.tasks.expandTitle, { title: task.title })

  const items: MenuItem[] = [
    { label: copy.tasks.edit, onClick: onEdit },
    {
      label: done ? copy.tasks.markIncomplete : copy.tasks.markComplete,
      onClick: onToggleComplete,
    },
    { label: copy.tasks.delete, destructive: true, onClick: onDelete },
  ]

  const band = bandFor(task.difficulty)
  const accent = bandAccent(band)
  const difficultyLabel = bandLabel(band)
  const difficultyAria =
    task.difficulty === null
      ? copy.tasks.difficultyUnrated
      : `${fill(copy.tasks.difficulty, { n: task.difficulty })}${
          difficultyLabel ? ` (${difficultyLabel})` : ''
        }`

  return (
    <li data-tour="task-row">
      <Card
        className={
          'flex items-center justify-between gap-3 py-3 ' +
          (done ? 'opacity-70' : '')
        }
        style={{ borderLeft: `4px solid ${accent}` }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onComplete}
            disabled={done || busyHere}
            aria-label={completeAria}
            title={done ? undefined : copy.tasks.tooltipCompleteIcon}
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
            <div className="mt-1 flex flex-col gap-y-0.5 text-xs text-[var(--muted)] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
              {task.difficulty !== null ? (
                <span
                  aria-label={difficultyAria}
                  style={{
                    fontFamily: 'var(--font-jetbrains)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full mr-1 align-middle"
                    style={{ backgroundColor: accent }}
                  />
                  {fill(copy.tasks.difficulty, { n: task.difficulty })}
                  {difficultyLabel ? (
                    <span aria-hidden="true" className="ml-1">
                      · {difficultyLabel}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span>{copy.tasks.difficultyUnrated}</span>
              )}
              {task.difficulty !== null && task.deadline ? (
                <span
                  aria-hidden="true"
                  className="hidden sm:inline text-[var(--muted-soft)]"
                >
                  |
                </span>
              ) : null}
              {task.deadline ? (
                <span
                  className={overdue ? 'text-[var(--danger)] font-medium' : ''}
                >
                  {overdue
                    ? copy.tasks.overdue + copy.tasks.metaSeparator
                    : ''}
                  {fill(copy.tasks.dueOn, {
                    date: formatShortDate(task.deadline, timezone),
                  })}
                </span>
              ) : null}
              {task.completed_at ? (
                <span>
                  {fill(copy.tasks.doneOn, {
                    date: formatShortDate(task.completed_at, timezone),
                  })}
                </span>
              ) : null}
              {onTime ? (
                <span className="text-[var(--secondary)]">
                  <span aria-hidden="true">✓ </span>
                  {copy.tasks.doneOnTime}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <Menu
          label={copy.tasks.menuAria}
          items={items}
          triggerLabel={fill(copy.tasks.menuLabel, { title: task.title })}
          triggerTitle={copy.tasks.tooltipMenu}
          triggerDisabled={busyHere}
          triggerClassName="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)]"
        >
          <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
        </Menu>
      </Card>
    </li>
  )
}
