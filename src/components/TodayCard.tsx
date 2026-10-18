'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy, fill } from '@/content/en'
import { pickMoodQuote } from '@/content/moodQuotes'
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

function emojiFor(mood: MoodScore): string {
  return MOODS.find((m) => m.score === mood)?.emoji ?? ''
}

export function TodayCard({
  initialMood,
  pointsToday,
  tasksDoneToday,
  onChanged,
}: Props) {
  const [mood, setMood] = useState<MoodScore>(initialMood)
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<MoodScore | null>(null)
  // Quote is picked after mount so SSR and client agree on an empty start,
  // then the client picks one randomly from the mood-specific list.
  const [quote, setQuote] = useState<string>('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuote(pickMoodQuote(mood))
  }, [mood])

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
  const emoji = emojiFor(mood)
  return (
    <Card aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[var(--text)] text-lg">
            <span className="font-bold">{copy.checkin.todayPrefix}</span>{' '}
            <span>{moodLabel}</span>{' '}
            <span aria-hidden="true" className="text-xl align-middle">
              {emoji}
            </span>
          </p>
          {quote ? (
            <p
              className="mt-2 italic text-[var(--muted)]"
              style={{ fontFamily: 'var(--font-fraunces)' }}
            >
              {quote}
            </p>
          ) : null}
          <p
            className="mt-2 text-sm text-[var(--muted)]"
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
