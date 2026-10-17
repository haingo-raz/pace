'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy, fill } from '@/content/en'
import type { CheckinResponse, MoodScore } from '@/types'

type Props = {
  onCheckedIn: (res: CheckinResponse | null) => void
}

const MOODS: { score: MoodScore; emoji: string }[] = [
  { score: 1, emoji: '🌧️' },
  { score: 2, emoji: '🌥️' },
  { score: 3, emoji: '☀️' },
  { score: 4, emoji: '🌈' },
]

export function MoodCheckIn({ onCheckedIn }: Props) {
  const toast = useToast()
  const [pending, setPending] = useState<MoodScore | null>(null)

  async function onPick(score: MoodScore) {
    if (pending !== null) return
    setPending(score)
    const res = await apiFetch<CheckinResponse>('/api/checkin', {
      method: 'POST',
      body: JSON.stringify({ mood: score }),
    })

    if (res.ok) {
      announce(
        fill(copy.checkin.announced, { points: res.data.pointsAwarded }),
      )
      onCheckedIn(res.data)
      return
    }

    if (res.error.code === 'CONFLICT') {
      announce(copy.checkin.done)
      onCheckedIn(null)
      return
    }

    const msg =
      (copy.errors as Record<string, string | undefined>)[res.error.code] ??
      copy.errors.generic
    toast.error(msg)
    setPending(null)
  }

  return (
    <Card>
      <h2
        className="font-semibold text-[var(--text)]"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
        }}
      >
        {copy.checkin.question}
      </h2>
      <div
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
        role="group"
        aria-label={copy.checkin.question}
      >
        {MOODS.map(({ score, emoji }) => {
          const label = copy.checkin.moods[score]
          const isBusy = pending === score
          return (
            <button
              key={score}
              type="button"
              onClick={() => onPick(score)}
              disabled={pending !== null}
              aria-busy={isBusy || undefined}
              className={
                'flex min-h-11 flex-col items-center justify-center gap-1 rounded-md border px-3 py-3 ' +
                'text-sm font-medium transition-colors disabled:opacity-60 ' +
                (isBusy
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
      <div className="mt-4">
        <button
          type="button"
          onClick={() => onCheckedIn(null)}
          className="inline-flex min-h-11 items-center px-3 text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--text)]"
        >
          {copy.checkin.skip}
        </button>
      </div>
    </Card>
  )
}
