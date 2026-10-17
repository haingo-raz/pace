'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Sparkline } from '@/components/Sparkline'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy, fill } from '@/content/en'
import type { Insight, SparkSeries } from '@/lib/insights'
import {
  INSIGHT_EFFORT_SPARK_MAX,
  INSIGHT_LATE_SPARK_MAX,
  INSIGHT_WINDOW_DAYS,
  MOOD_MAX,
  MOOD_MIN,
} from '@/config/constants'

type Props = {
  insight: Insight
  sentence: string
  streakAtRisk: boolean
}

function labelFor(series: SparkSeries): string {
  const days = INSIGHT_WINDOW_DAYS
  if (series.label === 'mood')
    return fill(copy.insight.moodSparkLabel, { days })
  if (series.label === 'effort')
    return fill(copy.insight.effortSparkLabel, { days })
  return fill(copy.insight.lateSparkLabel, { days })
}

function rangeFor(series: SparkSeries): { min: number; max: number } {
  if (series.label === 'mood') return { min: MOOD_MIN, max: MOOD_MAX }
  if (series.label === 'effort') return { min: 0, max: INSIGHT_EFFORT_SPARK_MAX }
  return { min: 0, max: INSIGHT_LATE_SPARK_MAX }
}

function sumNonNull(values: Array<number | null>): number {
  let total = 0
  for (const v of values) if (v !== null) total += v
  return total
}

function latest(values: Array<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i]
    if (v !== null) return v
  }
  return null
}

export function InsightCard({ insight, sentence, streakAtRisk }: Props) {
  const toast = useToast()
  const [dismissed, setDismissed] = useState(false)
  const [pending, setPending] = useState(false)

  const shouldHide =
    dismissed || insight.kind === 'STEADY' || insight.kind === 'NEED_MORE_DATA'

  async function onDismiss() {
    if (pending) return
    setPending(true)
    const res = await apiFetch<{ dismissed: boolean }>('/api/insight', {
      method: 'POST',
      body: JSON.stringify({ pattern: insight.kind }),
    })
    setPending(false)
    if (!res.ok) {
      const msg =
        (copy.errors as Record<string, string | undefined>)[res.error.code] ??
        copy.errors.generic
      toast.error(msg)
      return
    }
    announce(copy.insight.dismissed)
    setDismissed(true)
  }

  if (shouldHide) {
    if (streakAtRisk) {
      return (
        <Card role="status" className="border-[var(--accent)]">
          <p className="text-sm text-[var(--text)]">
            {copy.insight.streakAtRisk}
          </p>
        </Card>
      )
    }
    return null
  }

  return (
    <Card role="status" className="border-[var(--accent)]">
      <header className="flex items-start justify-between gap-3">
        <h2
          className="font-semibold text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
          }}
        >
          {copy.insight.heading}
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          disabled={pending}
          className="min-h-11 px-3 text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--text)]"
        >
          {copy.insight.dismiss}
        </button>
      </header>

      <p className="mt-2 text-[var(--text)]">{sentence}</p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <SparkCell series={insight.evidence.primary} />
        <SparkCell series={insight.evidence.secondary} />
      </div>

      {streakAtRisk ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          {copy.insight.streakAtRisk}
        </p>
      ) : null}
    </Card>
  )
}

function SparkCell({ series }: { series: SparkSeries }) {
  const { min, max } = rangeFor(series)
  const label = labelFor(series)
  const now = latest(series.values)
  const sum = sumNonNull(series.values)

  let summary: string
  if (series.label === 'mood') {
    summary =
      now !== null
        ? fill(copy.insight.moodSummary, { label, value: now, max })
        : fill(copy.insight.moodSummaryEmpty, { label })
  } else {
    summary = fill(copy.insight.totalSummary, {
      label,
      sum,
      days: INSIGHT_WINDOW_DAYS,
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Sparkline label={label} values={series.values} min={min} max={max} />
      <p
        className="text-xs text-[var(--muted)]"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {summary}
      </p>
    </div>
  )
}
