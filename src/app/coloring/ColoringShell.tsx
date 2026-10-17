'use client'

import { useCallback, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { PointsBadge } from '@/components/PointsBadge'
import { ColoringCanvas } from '@/components/ColoringCanvas'
import { ColourPicker } from '@/components/ColourPicker'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/http'
import { announce } from '@/lib/announce'
import { copy, fill } from '@/content/en'
import { COLOUR_PALETTE, COST_COLOR_SECTION } from '@/config/constants'
import type { ColoringPage } from '@/types'

type Props = {
  initialPage: ColoringPage
  initialState: Record<string, string>
  initialPointsTotal: number
  initialComplete: boolean
}

type FillResponse = {
  state: Record<string, string>
  pointsTotal: number
  complete: boolean
}

function colourName(hex: string): string {
  const h = hex.toUpperCase()
  return COLOUR_PALETTE.find((p) => p.hex.toUpperCase() === h)?.name ?? hex
}

export function ColoringShell({
  initialPage,
  initialState,
  initialPointsTotal,
  initialComplete,
}: Props) {
  const toast = useToast()
  const [state, setState] = useState<Record<string, string>>(initialState)
  const [pointsTotal, setPointsTotal] = useState(initialPointsTotal)
  const [complete, setComplete] = useState(initialComplete)
  const [selected, setSelected] = useState<string>(COLOUR_PALETTE[0].hex)
  const [pending, setPending] = useState(false)

  const total = initialPage.sections.length
  const done = Object.keys(state).length
  const unaffordable = pointsTotal < COST_COLOR_SECTION

  const onFill = useCallback(
    async (sectionId: string, position: number) => {
      if (pending || complete) return

      setPending(true)
      const res = await apiFetch<FillResponse>('/api/coloring/section', {
        method: 'POST',
        body: JSON.stringify({ sectionId, colour: selected }),
      })
      setPending(false)

      if (!res.ok) {
        const msg =
          (copy.errors as Record<string, string | undefined>)[res.error.code] ??
          copy.errors.generic
        toast.error(msg)
        return
      }

      setState(res.data.state)
      setPointsTotal(res.data.pointsTotal)
      setComplete(res.data.complete)
      const fillMsg = fill(copy.coloring.announced, {
        position,
        colour: colourName(selected),
        points: res.data.pointsTotal,
      })
      announce(
        res.data.complete
          ? `${fillMsg} ${copy.coloring.announcedCompleteSuffix}`
          : fillMsg,
      )
    },
    [pending, complete, selected, toast],
  )

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <h1
          className="font-semibold text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            textWrap: 'balance',
          }}
        >
          {initialPage.name}
        </h1>
        <PointsBadge total={pointsTotal} delta={null} />
      </header>

      <p className="mt-2 text-sm text-[var(--muted)]">
        {fill(copy.coloring.costNote, { cost: COST_COLOR_SECTION })}
      </p>

      <section className="mt-6">
        <Card>
          <ColoringCanvas
            page={initialPage}
            state={state}
            pointsTotal={pointsTotal}
            pending={pending}
            onFill={onFill}
          />
        </Card>

        <p
          className="mt-3 text-sm text-[var(--muted)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {fill(copy.coloring.progress, { done, total })}
        </p>

        {complete ? (
          <Card className="mt-4">
            <h2
              className="font-semibold text-[var(--text)]"
              style={{
                fontFamily: 'var(--font-fraunces)',
                fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
              }}
            >
              {copy.coloring.completeTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {copy.coloring.completeNote}
            </p>
          </Card>
        ) : unaffordable ? (
          <p className="mt-2 text-sm text-[var(--danger)]" role="status">
            {fill(copy.coloring.cantAfford, { cost: COST_COLOR_SECTION })}
          </p>
        ) : null}
      </section>

      {complete ? null : (
        <section className="mt-6">
          <h2
            className="font-semibold text-[var(--text)]"
            style={{
              fontFamily: 'var(--font-fraunces)',
              fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
            }}
          >
            {copy.coloring.pickerLabel}
          </h2>
          <div className="mt-3">
            <ColourPicker
              selected={selected}
              onPick={setSelected}
              disabled={pending}
            />
          </div>
        </section>
      )}
    </>
  )
}
