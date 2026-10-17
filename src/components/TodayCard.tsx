'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy, fill } from '@/content/en'
import type { MoodScore } from '@/types'

type Props = {
  initialMood: MoodScore
  pointsToday: number
  tasksDoneToday: number
  onChanged: (mood: MoodScore) => void
}

const MOODS: { score: MoodScore; emoji: string }[] = [
  { score: 1, emoji: '🌧️' },
  { score: 2, emoji: '🌥️' },
  { score: 3, emoji: '☀️' },
  { score: 4, emoji: '🌈' },
]

export function TodayCard({
  initialMood,
  pointsToday,
  tasksDoneToday,
  onChanged,
}: Props) {
  const [mood, setMood] = useState<MoodScore>(initialMood)
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<MoodScore | null>(null)

  async function pick(next: MoodScore) {
    if (pending !== null) return
    setPending(next)
    const res = await apiFetch<{ mood: MoodScore }>('/api/checkin', {
      method: 'PATCH',
      body: JSON.stringify({ mood: next }),
    })
    setPending(null)
    if (!res.ok) {
      announce(copy.checkin.changeFailed)
      return
    }
    setMood(res.data.mood)
    setEditing(false)
    announce(
      fill(copy.checkin.changeAnnounced, {
        mood: copy.checkin.moods[res.data.mood],
      }),
    )
    onChanged(res.data.mood)
  }

  if (editing) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">{copy.checkin.question}</p>
        <div
          className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
          role="group"
          aria-label={copy.checkin.question}
        >
          {MOODS.map(({ score, emoji }) => {
            const label = copy.checkin.moods[score]
            const isCurrent = score === mood
            const isBusy = pending === score
            return (
              <button
                key={score}
                type="button"
                onClick={() => pick(score)}
                disabled={pending !== null}
                aria-pressed={isCurrent}
                aria-busy={isBusy || undefined}
                className={
                  'flex min-h-11 flex-col items-center justify-center gap-1 rounded-md border px-3 py-3 ' +
                  'text-sm font-medium transition-colors disabled:opacity-60 ' +
                  (isCurrent
                    ? 'border-[var(--primary-strong)] bg-[var(--raised)] ring-2 ring-[var(--primary-strong)]'
                    : 'border-[var(--border)] bg-[var(--raised)] hover:border-[var(--primary-strong)]')
                }
              >
                <span aria-hidden="true" className="text-2xl leading-none">
                  {emoji}
                </span>
                <span className="text-[var(--text)]">{label}</span>
              </button>
            )
          })}
        </div>
      </Card>
    )
  }

  const moodLabel = copy.checkin.moods[mood]
  return (
    <Card aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[var(--text)]">
            {fill(copy.checkin.todayMood, { mood: moodLabel })}
          </p>
          <p
            className="mt-1 text-sm text-[var(--muted)]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {fill(copy.checkin.todayStats, {
              points: pointsToday,
              tasks: tasksDoneToday,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--text)]"
        >
          {copy.checkin.change}
        </button>
      </div>
    </Card>
  )
}
