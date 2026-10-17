'use client'

import { copy } from '@/content/en'
import type { DayPoint } from '@/lib/queries/stats'

export const CHART_FONT_PX = 11
export const CHART_FINAL_LABEL_FONT_PX = 12
export const CHART_TICK_COUNT = 4
export const CHART_AXIS_LABEL_OFFSET = 20
export const CHART_TICK_LABEL_GAP = 8

export type Trend = 'up' | 'down' | 'flat'

export function trendWord(t: Trend): string {
  if (t === 'up') return copy.stats.trendUp
  if (t === 'down') return copy.stats.trendDown
  return copy.stats.trendFlat
}

export function lineTrend(data: DayPoint[]): Trend {
  const present = data.filter(
    (p): p is { day: string; value: number } => p.value !== null,
  )
  if (present.length < 2) return 'flat'
  const first = present[0].value
  const last = present[present.length - 1].value
  if (last > first) return 'up'
  if (last < first) return 'down'
  return 'flat'
}

export function halvesTrend(data: DayPoint[]): Trend {
  const vals = data
    .map((d) => d.value)
    .filter((v): v is number => v !== null)
  if (vals.length < 2) return 'flat'
  const half = Math.floor(vals.length / 2)
  const firstHalf = vals.slice(0, half).reduce((a, b) => a + b, 0)
  const lastHalf = vals.slice(half).reduce((a, b) => a + b, 0)
  if (lastHalf > firstHalf) return 'up'
  if (lastHalf < firstHalf) return 'down'
  return 'flat'
}

export function buildTicks(min: number, max: number): number[] {
  const span = Math.max(max - min, 1)
  const step =
    span <= CHART_TICK_COUNT ? 1 : Math.ceil(span / CHART_TICK_COUNT)
  const ticks: number[] = []
  for (let v = min; v <= max; v += step) ticks.push(v)
  if (ticks[ticks.length - 1] !== max) ticks.push(max)
  return ticks
}

const NICE_CEILING_STEPS = [10, 20, 50, 100]

export function niceCeiling(v: number): number {
  for (const step of NICE_CEILING_STEPS) if (v <= step) return step
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)))
  return Math.ceil(v / magnitude) * magnitude
}

export function DataTable({
  title,
  data,
}: {
  title: string
  data: DayPoint[]
}) {
  return (
    <details>
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-[var(--muted)] underline underline-offset-4">
        {copy.stats.viewAsTable}
      </summary>
      <table className="mt-2 w-full border-collapse text-sm">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="border-b border-[var(--border)] py-1 text-left text-[var(--muted)]"
            >
              {copy.stats.day}
            </th>
            <th
              scope="col"
              className="border-b border-[var(--border)] py-1 text-right text-[var(--muted)]"
            >
              {copy.stats.value}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td className="py-1 text-[var(--text)]">{d.day}</td>
              <td
                className="py-1 text-right text-[var(--text)]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {d.value === null ? copy.stats.noEntry : d.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
