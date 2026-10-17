'use client'

import { copy, fill } from '@/content/en'
import {
  COLOUR_PALETTE,
  COLOUR_STROKE_EMPTY,
  COLOUR_STROKE_FILLED,
  COST_COLOR_SECTION,
} from '@/config/constants'
import type { ColoringPage } from '@/types'

type Props = {
  page: ColoringPage
  state: Record<string, string>
  pointsTotal: number
  pending: boolean
  onFill: (sectionId: string, position: number) => void
}

function colourName(hex: string): string {
  const h = hex.toUpperCase()
  const match = COLOUR_PALETTE.find((p) => p.hex.toUpperCase() === h)
  return match?.name ?? hex
}

export function ColoringCanvas({
  page,
  state,
  pointsTotal,
  pending,
  onFill,
}: Props) {
  const unaffordable = pointsTotal < COST_COLOR_SECTION
  const total = page.sections.length

  return (
    <div
      role="group"
      aria-label={copy.coloring.heading}
      className="overflow-x-auto"
    >
      <svg
        viewBox={page.view_box}
        className="max-w-full h-auto"
        style={{ touchAction: 'manipulation' }}
      >
        {page.sections.map((s, i) => {
          const filled = !!state[s.id]
          const position = i + 1
          const disabled = filled || unaffordable || pending
          const status = filled
            ? fill(copy.coloring.filled, { colour: colourName(state[s.id]) })
            : copy.coloring.empty
          const label = fill(copy.coloring.sectionAria, {
            position,
            total,
            status,
          })
          return (
            <path
              key={s.id}
              d={s.d}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-disabled={disabled}
              fill={filled ? state[s.id] : 'var(--surface)'}
              stroke="var(--text)"
              strokeWidth={filled ? COLOUR_STROKE_FILLED : COLOUR_STROKE_EMPTY}
              style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
              onClick={() => {
                if (disabled) return
                onFill(s.id, position)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (disabled) return
                  onFill(s.id, position)
                }
              }}
            />
          )
        })}
      </svg>
    </div>
  )
}
