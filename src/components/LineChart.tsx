'use client'

import { useState } from 'react'
import { copy, fill } from '@/content/en'
import { ONE_DECIMAL } from '@/config/constants'
import type { DayPoint } from '@/lib/queries/stats'
import {
  CHART_AXIS_LABEL_OFFSET,
  CHART_FINAL_LABEL_FONT_PX,
  CHART_FONT_PX,
  CHART_TICK_LABEL_GAP,
  DataTable,
  buildTicks,
  lineTrend,
  trendWord,
} from '@/components/charts/shared'

type Props = {
  title: string
  data: DayPoint[]
  min: number
  max: number
  unit?: string
}

const WIDTH = 560
const HEIGHT = 220
const PAD_LEFT = 40
const PAD_RIGHT = 56
const PAD_TOP = 20
const PAD_BOTTOM = 36
const INNER_W = WIDTH - PAD_LEFT - PAD_RIGHT
const INNER_H = HEIGHT - PAD_TOP - PAD_BOTTOM
const MARKER_RADIUS = 4
const FINAL_RADIUS = 6
const HIT_HALF_WIDTH = 14
const FINAL_LABEL_X_OFFSET = 10
const FINAL_LABEL_X_PAD = 4

function average(data: DayPoint[]): number | null {
  const vals = data
    .map((d) => d.value)
    .filter((v): v is number => v !== null)
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function round1(n: number): number {
  return Math.round(n * ONE_DECIMAL) / ONE_DECIMAL
}

export function LineChart({ title, data, min, max, unit }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const n = data.length
  const span = Math.max(max - min, 1)
  const stepX = n > 1 ? INNER_W / (n - 1) : 0
  const x = (i: number) => PAD_LEFT + i * stepX
  const y = (v: number) => PAD_TOP + INNER_H - ((v - min) / span) * INNER_H
  const baseY = PAD_TOP + INNER_H

  const segments: string[] = []
  let d = ''
  data.forEach((p, i) => {
    if (p.value === null) {
      if (d) {
        segments.push(d)
        d = ''
      }
      return
    }
    const cmd = d === '' ? 'M' : 'L'
    d += ` ${cmd} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`
  })
  if (d) segments.push(d)

  const presentPoints = data
    .map((p, i) => ({ p, i }))
    .filter((e): e is { p: { day: string; value: number }; i: number } => e.p.value !== null)
  const lastPresent = presentPoints[presentPoints.length - 1] ?? null

  const trendText = trendWord(lineTrend(data))
  const avg = average(data)
  const avgText =
    avg === null
      ? copy.stats.ariaNoData
      : fill(copy.stats.ariaAverage, {
          avg: round1(avg),
          max,
          unit: unit ?? '',
        })
  const ariaLabel = fill(copy.stats.lineAria, {
    title,
    days: n,
    averageSummary: avgText,
    trend: trendText,
  })

  const yTicks = buildTicks(min, max)
  const hover = hoverIdx !== null ? data[hoverIdx] : null

  return (
    <div className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_LEFT}
              y1={y(t)}
              x2={WIDTH - PAD_RIGHT}
              y2={y(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - CHART_TICK_LABEL_GAP}
              y={y(t)}
              dy="0.35em"
              textAnchor="end"
              className="fill-[var(--muted)]"
              style={{ fontSize: CHART_FONT_PX }}
            >
              {t}
            </text>
          </g>
        ))}

        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.trim()}
            fill="none"
            stroke="var(--secondary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {presentPoints.map(({ p, i }) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.value)}
            r={i === lastPresent?.i ? FINAL_RADIUS : MARKER_RADIUS}
            fill="var(--secondary)"
          />
        ))}

        {lastPresent ? (
          <text
            x={Math.min(
              x(lastPresent.i) + FINAL_LABEL_X_OFFSET,
              WIDTH - FINAL_LABEL_X_PAD,
            )}
            y={y(lastPresent.p.value)}
            dy="0.35em"
            textAnchor="start"
            className="fill-[var(--text)]"
            style={{ fontSize: CHART_FINAL_LABEL_FONT_PX, fontWeight: 600 }}
          >
            {lastPresent.p.value}
          </text>
        ) : null}

        <line
          x1={PAD_LEFT}
          y1={baseY}
          x2={WIDTH - PAD_RIGHT}
          y2={baseY}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <text
          x={PAD_LEFT}
          y={baseY + CHART_AXIS_LABEL_OFFSET}
          textAnchor="start"
          className="fill-[var(--muted)]"
          style={{ fontSize: CHART_FONT_PX }}
        >
          {data[0]?.day ?? ''}
        </text>
        <text
          x={WIDTH - PAD_RIGHT}
          y={baseY + CHART_AXIS_LABEL_OFFSET}
          textAnchor="end"
          className="fill-[var(--muted)]"
          style={{ fontSize: CHART_FONT_PX }}
        >
          {data[data.length - 1]?.day ?? ''}
        </text>

        {hover ? (
          <line
            x1={x(hoverIdx ?? 0)}
            y1={PAD_TOP}
            x2={x(hoverIdx ?? 0)}
            y2={baseY}
            stroke="var(--muted)"
            strokeWidth={1}
            strokeDasharray="2 2"
            aria-hidden="true"
          />
        ) : null}

        {data.map((_, i) => (
          <rect
            key={i}
            x={x(i) - HIT_HALF_WIDTH}
            y={PAD_TOP}
            width={HIT_HALF_WIDTH * 2}
            height={INNER_H}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}
      </svg>

      {hover ? (
        <p
          className="text-xs text-[var(--muted)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {hover.day}:{' '}
          {hover.value === null ? copy.stats.noEntry : hover.value}
          {unit && hover.value !== null ? ` ${unit}` : ''}
        </p>
      ) : (
        <p className="text-xs text-[var(--muted)]">{avgText}</p>
      )}

      <DataTable title={title} data={data} />
    </div>
  )
}
