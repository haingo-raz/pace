'use client'

import { FormEvent, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { copy } from '@/content/en'
import {
  DIFFICULTY_DEFAULT,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  DIFFICULTY_STEP,
  TASK_TITLE_MAX,
} from '@/config/constants'
import type { Difficulty, Task } from '@/types'

type MutationResponse = {
  task: Task
  pointsAwarded: number
  pointsTotal: number | null
}

type Props = {
  onAdded: (res: MutationResponse) => void
}

export function AddTaskForm({ onAdded }: Props) {
  const toast = useToast()
  const titleRef = useRef<HTMLInputElement>(null)
  const sliderId = useId()
  const sliderValueId = `${sliderId}-value`
  const sliderHintId = `${sliderId}-hint`
  const sliderErrorId = `${sliderId}-error`

  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<number>(DIFFICULTY_DEFAULT)
  const [difficultyTouched, setDifficultyTouched] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function reset() {
    setTitle('')
    setDifficulty(DIFFICULTY_DEFAULT)
    setDifficultyTouched(false)
    setDeadline('')
    setFieldErrors({})
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setFieldErrors({ title: copy.tasks.titleRequired })
      titleRef.current?.focus()
      return
    }

    setPending(true)
    setFieldErrors({})

    const payload = {
      title: trimmedTitle,
      difficulty: (difficultyTouched ? difficulty : null) as Difficulty | null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
    }

    const res = await apiFetch<MutationResponse>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    setPending(false)

    if (res.ok) {
      onAdded(res.data)
      reset()
      return
    }

    if (res.error.code === 'VALIDATION_ERROR') {
      const details = res.error.details as
        | { fields?: Record<string, string> }
        | undefined
      const fields = details?.fields ?? {}
      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields)
        return
      }
      toast.error(copy.errors.VALIDATION_ERROR)
      return
    }

    const msg =
      (copy.errors as Record<string, string | undefined>)[res.error.code] ??
      copy.errors.generic
    toast.error(msg)
  }

  const difficultyError = fieldErrors.difficulty ?? null
  const describedBy =
    [sliderValueId, sliderHintId, difficultyError ? sliderErrorId : null]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          ref={titleRef}
          label={copy.tasks.titleLabel}
          placeholder={copy.tasks.titlePlaceholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TASK_TITLE_MAX}
          error={fieldErrors.title ?? null}
          required
        />

        <div className="flex flex-col gap-2">
          <label
            htmlFor={sliderId}
            className="text-sm font-medium text-[var(--text)]"
          >
            {copy.tasks.difficultyLabel}
          </label>
          <div className="flex items-center gap-3">
            <input
              id={sliderId}
              type="range"
              min={DIFFICULTY_MIN}
              max={DIFFICULTY_MAX}
              step={DIFFICULTY_STEP}
              value={difficulty}
              onChange={(e) => {
                setDifficulty(Number(e.target.value))
                setDifficultyTouched(true)
              }}
              aria-invalid={difficultyError ? true : undefined}
              aria-describedby={describedBy}
              className="flex-1"
              style={{ accentColor: 'var(--primary-strong)' }}
            />
            <span
              id={sliderValueId}
              className="min-w-16 text-sm text-[var(--text)]"
              style={{
                fontFamily: 'var(--font-jetbrains)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {difficultyTouched ? difficulty : copy.tasks.difficultyPlaceholder}
            </span>
            {difficultyTouched ? (
              <button
                type="button"
                onClick={() => {
                  setDifficulty(DIFFICULTY_DEFAULT)
                  setDifficultyTouched(false)
                }}
                aria-label={copy.tasks.clearDifficultyAria}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--danger)]"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            ) : null}
          </div>
          <p id={sliderHintId} className="text-sm text-[var(--muted)]">
            {difficultyTouched
              ? copy.tasks.difficultyHint
              : copy.tasks.difficultyUnrated}
          </p>
          {difficultyError ? (
            <p
              id={sliderErrorId}
              role="alert"
              className="text-sm text-[var(--danger)]"
            >
              {difficultyError}
            </p>
          ) : null}
        </div>

        <Input
          label={copy.tasks.deadlineLabel}
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          hint={copy.tasks.deadlineHint}
          error={fieldErrors.deadline ?? null}
        />

        <div>
          <Button type="submit" pending={pending}>
            {copy.tasks.add}
          </Button>
        </div>
      </form>
    </Card>
  )
}
