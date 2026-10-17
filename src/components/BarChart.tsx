'use client'

import { useState } from 'react'
import { copy, fill } from '@/content/en'
import type { DayPoint } from '@/lib/queries/stats'
import {
  CHART_AXIS_LABEL_OFFSET,
  CHART_FONT_PX,
  CHART_TICK_LABEL_GAP,
  DataTable,
  buildTicks,
  halvesTrend,
  niceCeiling,
  trendWord,
} from '@/components/charts/shared'

type Props = {
  title: string
  data: DayPoint[]
  unit?: string
}

const WIDTH = 560
const HEIGHT = 220
const PAD_LEFT = 44
const PAD_RIGHT = 20
const PAD_TOP = 20
const PAD_BOTTOM = 36
const INNER_W = WIDTH - PAD_LEFT - PAD_RIGHT
const INNER_H = HEIGHT - PAD_TOP - PAD_BOTTOM
const BAR_GAP = 2
const BAR_RADIUS = 4

function sum(data: DayPoint[]): number {
  return data.reduce((acc, d) => acc + (d.value ?? 0), 0)
}

export function BarChart({ title, data, unit }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const n = Math.max(data.length, 1)
  const totalGap = BAR_GAP * (n - 1)
  const barW = Math.max((INNER_W - totalGap) / n, 1)
  const dataMax = Math.max(1, ...data.map((d) => d.value ?? 0))
  const niceMax = niceCeiling(dataMax)
  const baseY = PAD_TOP + INNER_H

  const x = (i: number) => PAD_LEFT + i * (barW + BAR_GAP)
  const h = (v: number) => (v / niceMax) * INNER_H

  const trendText = trendWord(halvesTrend(data))
  const total = sum(data)
  const ariaLabel = fill(copy.stats.barAria, {
    title,
    days: data.length,
    total,
    unit: unit ?? '',
    trend: trendText,
  })

  const yTicks = buildTicks(0, niceMax)
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
              y1={baseY - h(t)}
              x2={WIDTH - PAD_RIGHT}
              y2={baseY - h(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - CHART_TICK_LABEL_GAP}
              y={baseY - h(t)}
              dy="0.35em"
              textAnchor="end"
              className="fill-[var(--muted)]"
              style={{ fontSize: CHART_FONT_PX }}
            >
              {t}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const v = d.value ?? 0
          const bh = h(v)
          const by = baseY - bh
          return (
            <g key={d.day}>
              <rect
                x={x(i)}
                y={by}
                width={barW}
                height={Math.max(bh, 0)}
                rx={BAR_RADIUS}
                ry={BAR_RADIUS}
                fill="var(--accent)"
              />
              <rect
                x={x(i)}
                y={PAD_TOP}
                width={barW}
                height={INNER_H}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            </g>
          )
        })}

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
      </svg>

      {hover ? (
        <p
          className="text-xs text-[var(--muted)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {hover.day}: {hover.value ?? 0}
          {unit ? ` ${unit}` : ''}
        </p>
      ) : (
        <p
          className="text-xs text-[var(--muted)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {fill(copy.stats.barSummary, {
            total,
            days: data.length,
            unit: unit ?? '',
          })}
        </p>
      )}

      <DataTable title={title} data={data} />
    </div>
  )
}
