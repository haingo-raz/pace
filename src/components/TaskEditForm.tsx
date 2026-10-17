'use client'

import {
  SyntheticEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy } from '@/content/en'
import {
  DIFFICULTY_DEFAULT,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  DIFFICULTY_STEP,
  TASK_TITLE_MAX,
} from '@/config/constants'
import type { Difficulty, Task, TaskGroup } from '@/types'

type Props = {
  task: Task
  groups: TaskGroup[]
  onSaved: (task: Task) => void
  onCancel: () => void
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  )
}

export function TaskEditForm({ task, groups, onSaved, onCancel }: Props) {
  const toast = useToast()
  const titleRef = useRef<HTMLInputElement>(null)
  const sliderId = useId()
  const sliderValueId = `${sliderId}-value`
  const sliderHintId = `${sliderId}-hint`
  const groupFieldId = useId()

  const [title, setTitle] = useState(task.title)
  const [hasDifficulty, setHasDifficulty] = useState(task.difficulty !== null)
  const [difficulty, setDifficulty] = useState<number>(
    task.difficulty ?? DIFFICULTY_DEFAULT,
  )
  const [deadline, setDeadline] = useState(toLocalInput(task.deadline))
  const [groupId, setGroupId] = useState(task.group_id ?? '')
  const [pending, setPending] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)

  useEffect(() => {
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [])

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const deadlineInPast =
    mounted && !!deadline && new Date(deadline) < new Date()

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError(copy.tasks.titleRequired)
      titleRef.current?.focus()
      return
    }

    setPending(true)
    setTitleError(null)

    const payload = {
      action: 'edit' as const,
      title: trimmed,
      difficulty: (hasDifficulty ? difficulty : null) as Difficulty | null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      groupId: groupId || null,
    }

    const res = await apiFetch<{ task: Task }>(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })

    setPending(false)

    if (!res.ok) {
      if (res.error.code === 'VALIDATION_ERROR') {
        const details = res.error.details as
          | { fields?: Record<string, string> }
          | undefined
        const fields = details?.fields ?? {}
        if (fields.title) {
          setTitleError(fields.title)
          return
        }
      }
      const msg =
        (copy.errors as Record<string, string | undefined>)[res.error.code] ??
        copy.errors.generic
      toast.error(msg)
      return
    }

    toast.success(copy.tasks.editSaved)
    announce(copy.tasks.editSaved)
    onSaved(res.data.task)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--raised)] p-4"
      aria-label={copy.tasks.editHeading}
    >
      <Input
        ref={titleRef}
        label={copy.tasks.titleLabel}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={TASK_TITLE_MAX}
        error={titleError}
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
              setHasDifficulty(true)
            }}
            aria-describedby={`${sliderValueId} ${sliderHintId}`}
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
            {hasDifficulty ? difficulty : copy.tasks.difficultyPlaceholder}
          </span>
          {hasDifficulty ? (
            <button
              type="button"
              onClick={() => {
                setHasDifficulty(false)
                setDifficulty(DIFFICULTY_DEFAULT)
              }}
              aria-label={copy.tasks.clearDifficultyAria}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--danger)]"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        <p id={sliderHintId} className="text-sm text-[var(--muted)]">
          {hasDifficulty
            ? copy.tasks.difficultyHintEdit
            : copy.tasks.difficultyUnrated}
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={copy.tasks.deadlineLabel}
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            hint={deadlineInPast ? copy.tasks.deadlinePast : undefined}
          />
        </div>
        {deadline ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDeadline('')}
            className="mb-[1px]"
          >
            {copy.tasks.deadlineClear}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={groupFieldId}
          className="text-sm font-medium text-[var(--text)]"
        >
          {copy.tasks.groupLabel}
        </label>
        <select
          id={groupFieldId}
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-base text-[var(--text)]"
        >
          <option value="">{copy.tasks.groupNone}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" pending={pending}>
          {copy.tasks.editSave}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {copy.tasks.editCancel}
        </Button>
      </div>
    </form>
  )
}
