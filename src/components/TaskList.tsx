'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy, fill } from '@/content/en'
import type { Task } from '@/types'
import { Check, Trash2 } from 'lucide-react'

type Mutation = {
  pointsAwarded: number
  pointsTotal: number | null
}

type Props = {
  tasks: Task[]
  onCompleted: (updated: Task, m: Mutation) => void
  onDeleted: (id: string) => void
}

/** YYYY-MM-DD portion of an ISO string.*/
function stableDay(iso: string): string {
  return iso.slice(0, 10)
}

export function TaskList({ tasks, onCompleted, onDeleted }: Props) {
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const headingRef = useRef<HTMLHeadingElement>(null)
  const prevTaskIds = useRef<string[]>(tasks.map((t) => t.id))

  useEffect(() => {
    const prev = prevTaskIds.current
    const current = tasks.map((t) => t.id)
    const removed = prev.find((id) => !current.includes(id))
    if (removed && headingRef.current) {
      headingRef.current.focus()
    }
    prevTaskIds.current = current
  }, [tasks])

  if (tasks.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">{copy.tasks.empty}</p>
      </Card>
    )
  }

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
    onCompleted(res.data.task, {
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

  return (
    <>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="sr-only focus:outline-none"
      >
        {copy.tasks.heading}
      </h3>
      <ul className="flex flex-col gap-2">
        {tasks.map((t) => {
          const done = !!t.completed_at
          const overdue =
            mounted &&
            !done &&
            t.deadline !== null &&
            new Date(t.deadline) < new Date()
          const completeAria = done
            ? fill(copy.tasks.completedLabel, { title: t.title })
            : fill(copy.tasks.completeLabel, { title: t.title })
          return (
            <li key={t.id}>
              <Card
                className={
                  'flex items-center justify-between gap-3 py-3 ' +
                  (done ? 'opacity-70' : '')
                }
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => complete(t)}
                    disabled={done || busyId === t.id}
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
                    <p
                      className={
                        'truncate text-[var(--text)] ' +
                        (done ? 'line-through' : '')
                      }
                    >
                      {t.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                      <span
                        style={{
                          fontFamily: 'var(--font-jetbrains)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {t.difficulty === null
                          ? copy.tasks.difficultyUnrated
                          : fill(copy.tasks.difficulty, { n: t.difficulty })}
                      </span>
                      {t.deadline ? (
                        <span
                          className={
                            overdue ? 'text-[var(--danger)] font-medium' : ''
                          }
                        >
                          {overdue
                            ? copy.tasks.overdue + copy.tasks.metaSeparator
                            : ''}
                          {fill(copy.tasks.due, {
                            date: stableDay(t.deadline),
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(t)}
                  disabled={busyId === t.id}
                  aria-label={fill(copy.tasks.deleteLabel, { title: t.title })}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--danger)]"
                >
                  <Trash2 aria-hidden="true" className="h-5 w-5" />
                </button>
              </Card>
            </li>
          )
        })}
      </ul>
    </>
  )
}
