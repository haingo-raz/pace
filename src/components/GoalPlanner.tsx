'use client'

import { SyntheticEvent, useId, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy, fill } from '@/content/en'
import {
  DAY_OFFSET_MAX,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  GOAL_INPUT_MAX,
  TASK_TITLE_MAX,
} from '@/config/constants'
import { X } from 'lucide-react'
import type { Plan, ProposedTask, Task } from '@/types'

type Row = ProposedTask & { key: string }

type AcceptResponse = { tasks: Task[] }

type Props = {
  onAccepted: (tasks: Task[]) => void
}

function dayLabel(offset: number): string {
  if (offset === 0) return copy.planner.dayToday
  if (offset === 1) return copy.planner.dayTomorrow
  return fill(copy.planner.dayInDays, { n: offset })
}

export function GoalPlanner({ onAccepted }: Props) {
  const toast = useToast()
  const goalFieldId = useId()

  const [goal, setGoal] = useState('')
  const [goalError, setGoalError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [unavailable, setUnavailable] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)

  function discard() {
    setPlan(null)
    setRows([])
  }

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const trimmed = goal.trim()
    if (!trimmed) {
      setGoalError(copy.planner.goalRequired)
      return
    }
    setPending(true)
    setGoalError(null)
    setUnavailable(false)
    setRateLimited(false)

    const res = await apiFetch<{ plan: Plan }>('/api/goals/plan', {
      method: 'POST',
      body: JSON.stringify({ goal: trimmed }),
    })

    setPending(false)

    if (!res.ok) {
      if (res.error.code === 'AI_UNAVAILABLE') {
        setUnavailable(true)
        return
      }
      if (res.error.code === 'RATE_LIMITED') {
        setRateLimited(true)
        return
      }
      if (res.error.code === 'VALIDATION_ERROR') {
        const details = res.error.details as
          | { fields?: Record<string, string> }
          | undefined
        setGoalError(details?.fields?.goal ?? copy.errors.VALIDATION_ERROR)
        return
      }
      const msg =
        (copy.errors as Record<string, string | undefined>)[res.error.code] ??
        copy.errors.generic
      toast.error(msg)
      return
    }

    setPlan(res.data.plan)
    setRows(
      res.data.plan.tasks.map((t, i) => ({ ...t, key: `${Date.now()}-${i}` })),
    )
    announce(
      fill(copy.planner.announcedPlan, { n: res.data.plan.tasks.length }),
    )
  }

  function updateRow(key: string, patch: Partial<ProposedTask>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    )
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  const blankTitleKeys = new Set(
    rows.filter((r) => !r.title.trim()).map((r) => r.key),
  )
  const canAccept =
    rows.length > 0 && blankTitleKeys.size === 0 && !accepting

  async function accept() {
    if (!canAccept) return
    setAccepting(true)
    const payload = {
      tasks: rows.map(({ title, difficulty, dayOffset }) => ({
        title: title.trim(),
        difficulty,
        dayOffset,
      })),
    }
    const res = await apiFetch<AcceptResponse>('/api/goals/accept', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setAccepting(false)

    if (!res.ok) {
      const msg =
        (copy.errors as Record<string, string | undefined>)[res.error.code] ??
        copy.errors.generic
      toast.error(msg)
      return
    }

    announce(fill(copy.planner.announcedAccepted, { n: res.data.tasks.length }))
    onAccepted(res.data.tasks)
    setGoal('')
    setPlan(null)
    setRows([])
  }

  if (unavailable || rateLimited) {
    return (
      <Card>
        <h3
          className="font-semibold text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
          }}
        >
          {copy.planner.fallbackHeading}
        </h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {rateLimited ? copy.planner.rateLimited : copy.planner.fallbackBody}
        </p>
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setUnavailable(false)
              setRateLimited(false)
            }}
          >
            {copy.planner.discard}
          </Button>
        </div>
      </Card>
    )
  }

  if (plan) {
    return (
      <Card>
        <section>
          <h3
            className="font-semibold text-[var(--text)]"
            style={{
              fontFamily: 'var(--font-fraunces)',
              fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
            }}
          >
            {copy.planner.criticHeading}
          </h3>
          {plan.isSmart ? (
            <p className="mt-2 text-sm text-[var(--text)]">
              {copy.planner.isSmart}
            </p>
          ) : null}
          {plan.missing.length > 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--text)]">
                {copy.planner.missingHeading}:{' '}
              </span>
              {plan.missing.join(', ')}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--text)]">
              {copy.planner.reframedHeading}:{' '}
            </span>
            {plan.reframedGoal}
          </p>
        </section>

        {plan.sustainability.trim() ? (
          <section
            className="mt-4 rounded-md border border-[var(--primary-strong)] bg-[var(--raised)] p-4"
            role="note"
          >
            <h3
              className="text-sm font-semibold text-[var(--primary-strong)]"
              style={{ fontFamily: 'var(--font-fraunces)' }}
            >
              {copy.planner.sustainabilityHeading}
            </h3>
            <p className="mt-1 text-sm text-[var(--text)]">
              {plan.sustainability}
            </p>
          </section>
        ) : null}

        {rows.length > 0 ? (
          <section className="mt-4">
            <h3
              className="font-semibold text-[var(--text)]"
              style={{
                fontFamily: 'var(--font-fraunces)',
                fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
              }}
            >
              {copy.planner.tasksHeading}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {copy.planner.tasksHint}
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {rows.map((r) => (
                <li
                  key={r.key}
                  className="rounded-md border border-[var(--border)] bg-[var(--raised)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Input
                        label={copy.planner.titleLabel}
                        value={r.title}
                        onChange={(e) =>
                          updateRow(r.key, { title: e.target.value })
                        }
                        maxLength={TASK_TITLE_MAX}
                        error={
                          blankTitleKeys.has(r.key)
                            ? copy.tasks.titleRequired
                            : null
                        }
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      aria-label={fill(copy.planner.removeAria, {
                        title: r.title,
                      })}
                      className="mt-7 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--danger)]"
                    >
                      <X aria-hidden="true" className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text)]">
                      {copy.planner.difficultyLabel}
                      <input
                        type="number"
                        min={DIFFICULTY_MIN}
                        max={DIFFICULTY_MAX}
                        value={r.difficulty}
                        onChange={(e) =>
                          updateRow(r.key, {
                            difficulty: Math.max(
                              DIFFICULTY_MIN,
                              Math.min(
                                DIFFICULTY_MAX,
                                Number(e.target.value) || DIFFICULTY_MIN,
                              ),
                            ),
                          })
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--text)]"
                        style={{ fontFamily: 'var(--font-jetbrains)' }}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text)]">
                      {copy.planner.dayLabel}
                      <select
                        value={r.dayOffset}
                        onChange={(e) =>
                          updateRow(r.key, { dayOffset: Number(e.target.value) })
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--text)]"
                      >
                        {Array.from({ length: DAY_OFFSET_MAX + 1 }, (_, i) => (
                          <option key={i} value={i}>
                            {dayLabel(i)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={accept}
            pending={accepting}
            disabled={!canAccept}
          >
            {rows.length === 0
              ? copy.planner.acceptNone
              : rows.length === 1
                ? copy.planner.acceptOne
                : fill(copy.planner.accept, { n: rows.length })}
          </Button>
          <Button type="button" variant="secondary" onClick={discard}>
            {copy.planner.discard}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={goalFieldId}
            className="text-sm font-medium text-[var(--text)]"
          >
            {copy.planner.inputLabel}
          </label>
          <textarea
            id={goalFieldId}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={copy.planner.inputPlaceholder}
            maxLength={GOAL_INPUT_MAX}
            rows={3}
            aria-invalid={goalError ? true : undefined}
            aria-describedby={goalError ? `${goalFieldId}-error` : undefined}
            className={
              'w-full rounded-md border px-3 py-2 bg-[var(--raised)] text-[var(--text)] text-base ' +
              (goalError
                ? 'border-[var(--danger)]'
                : 'border-[var(--border)]')
            }
          />
          <p className="text-sm text-[var(--muted)]">{copy.planner.hint}</p>
          {goalError ? (
            <p
              id={`${goalFieldId}-error`}
              role="alert"
              className="text-sm text-[var(--danger)]"
            >
              {goalError}
            </p>
          ) : null}
        </div>
        <div>
          <Button type="submit" pending={pending}>
            {pending ? copy.planner.pending : copy.planner.submit}
          </Button>
          {pending ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {copy.planner.pendingNote}
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  )
}
