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
  TASK_GROUP_TITLE_MAX,
  TASK_TITLE_MAX,
} from '@/config/constants'
import { announce } from '@/lib/announce'
import type { Difficulty, Task, TaskGroup } from '@/types'

const NEW_GROUP_VALUE = '__new__'

type MutationResponse = {
  task: Task
  pointsAwarded: number
  pointsTotal: number | null
}

type Props = {
  onAdded: (res: MutationResponse) => void
  groups: TaskGroup[]
  onGroupCreated?: (group: TaskGroup) => void
}

export function AddTaskForm({ onAdded, groups, onGroupCreated }: Props) {
  const toast = useToast()
  const titleRef = useRef<HTMLInputElement>(null)
  const newGroupRef = useRef<HTMLInputElement>(null)
  const sliderId = useId()
  const sliderValueId = `${sliderId}-value`
  const sliderHintId = `${sliderId}-hint`
  const sliderErrorId = `${sliderId}-error`
  const groupId = useId()
  const newGroupId = useId()

  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<number>(DIFFICULTY_DEFAULT)
  const [difficultyTouched, setDifficultyTouched] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [groupSelection, setGroupSelection] = useState<string>('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function reset() {
    setTitle('')
    setDifficulty(DIFFICULTY_DEFAULT)
    setDifficultyTouched(false)
    setDeadline('')
    setGroupSelection('')
    setCreatingGroup(false)
    setNewGroupName('')
    setFieldErrors({})
  }

  function onGroupChange(value: string) {
    if (value === NEW_GROUP_VALUE) {
      setCreatingGroup(true)
      setGroupSelection('')
      setFieldErrors((f) => ({ ...f, newGroup: '' }))
      setTimeout(() => newGroupRef.current?.focus(), 0)
      return
    }
    setGroupSelection(value)
  }

  function cancelNewGroup() {
    setCreatingGroup(false)
    setNewGroupName('')
    setFieldErrors((f) => ({ ...f, newGroup: '' }))
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

    const trimmedNewGroup = newGroupName.trim()
    if (creatingGroup && !trimmedNewGroup) {
      setFieldErrors({ newGroup: copy.groups.titleRequired })
      newGroupRef.current?.focus()
      return
    }

    setPending(true)
    setFieldErrors({})

    let effectiveGroupId: string | null = groupSelection || null

    if (creatingGroup) {
      const gres = await apiFetch<{ group: TaskGroup }>('/api/task-groups', {
        method: 'POST',
        body: JSON.stringify({ title: trimmedNewGroup }),
      })
      if (!gres.ok) {
        setPending(false)
        if (gres.error.code === 'VALIDATION_ERROR') {
          const details = gres.error.details as
            | { fields?: Record<string, string> }
            | undefined
          const msg = details?.fields?.title ?? copy.errors.VALIDATION_ERROR
          setFieldErrors({ newGroup: msg })
          newGroupRef.current?.focus()
          return
        }
        const msg =
          (copy.errors as Record<string, string | undefined>)[gres.error.code] ??
          copy.errors.generic
        toast.error(msg)
        return
      }
      effectiveGroupId = gres.data.group.id
      announce(copy.tasks.groupCreated)
      onGroupCreated?.(gres.data.group)
    }

    const payload = {
      title: trimmedTitle,
      difficulty: (difficultyTouched ? difficulty : null) as Difficulty | null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      groupId: effectiveGroupId,
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

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={creatingGroup ? newGroupId : groupId}
            className="text-sm font-medium text-[var(--text)]"
          >
            {creatingGroup ? copy.tasks.newGroupLabel : copy.tasks.groupLabel}
          </label>
          {creatingGroup ? (
            <>
              <div className="flex items-start gap-2">
                <input
                  ref={newGroupRef}
                  id={newGroupId}
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  maxLength={TASK_GROUP_TITLE_MAX}
                  placeholder={copy.tasks.newGroupPlaceholder}
                  aria-invalid={fieldErrors.newGroup ? true : undefined}
                  className={
                    'flex-1 rounded-md border px-3 py-2 bg-[var(--raised)] text-[var(--text)] text-base ' +
                    (fieldErrors.newGroup
                      ? 'border-[var(--danger)]'
                      : 'border-[var(--border)]')
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cancelNewGroup}
                  aria-label={copy.tasks.newGroupCancel}
                >
                  {copy.tasks.editCancel}
                </Button>
              </div>
              {fieldErrors.newGroup ? (
                <p role="alert" className="text-sm text-[var(--danger)]">
                  {fieldErrors.newGroup}
                </p>
              ) : null}
            </>
          ) : (
            <select
              id={groupId}
              value={groupSelection}
              onChange={(e) => onGroupChange(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-base text-[var(--text)]"
            >
              <option value="">{copy.tasks.groupNone}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
              <option value={NEW_GROUP_VALUE}>{copy.tasks.groupNew}</option>
            </select>
          )}
        </div>

        <div>
          <Button type="submit" pending={pending}>
            {copy.tasks.add}
          </Button>
        </div>
      </form>
    </Card>
  )
}
